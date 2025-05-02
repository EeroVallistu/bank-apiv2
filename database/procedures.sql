USE bank_api;

-- Procedure to create a new account for a user
DELIMITER //
CREATE PROCEDURE create_account(
    IN p_user_id INT,
    IN p_currency VARCHAR(3),
    IN p_name VARCHAR(100),
    IN p_initial_balance DECIMAL(15, 2),
    IN p_bank_prefix VARCHAR(3) -- Add bank prefix as parameter
)
BEGIN
    DECLARE new_account_number VARCHAR(50);
    DECLARE bank_prefix VARCHAR(3);
    
    -- Use the provided bank prefix from parameter instead of database
    SET bank_prefix = p_bank_prefix;
    
    -- Set default if no prefix provided
    IF bank_prefix IS NULL OR bank_prefix = '' THEN
        -- Fallback to database as a last resort
        SELECT value INTO bank_prefix FROM settings WHERE name = 'bank_prefix' ORDER BY updated_at DESC LIMIT 1;
        
        -- Set default if still no prefix found
        IF bank_prefix IS NULL THEN
            SET bank_prefix = '000';
            
            -- Insert default prefix if missing
            INSERT IGNORE INTO settings (name, value, description) 
            VALUES ('bank_prefix', bank_prefix, 'Bank prefix for account numbers');
        END IF;
    END IF;
    
    -- Generate account number
    SET new_account_number = CONCAT(
        bank_prefix, 
        SUBSTRING(MD5(CONCAT(p_user_id, NOW(), RAND())), 1, 17)
    );
    
    -- Create new account
    INSERT INTO accounts (
        account_number,
        user_id,
        balance,
        currency,
        name
    ) VALUES (
        new_account_number,
        p_user_id,
        p_initial_balance,
        p_currency,
        p_name
    );
    
    -- Return the new account ID
    SELECT LAST_INSERT_ID() as account_id, new_account_number as account_number;
END //
DELIMITER ;

-- Procedure to execute an internal money transfer
DELIMITER //
CREATE PROCEDURE execute_internal_transfer(
    IN p_from_account VARCHAR(50),
    IN p_to_account VARCHAR(50),
    IN p_amount DECIMAL(15, 2),
    IN p_explanation VARCHAR(255),
    IN p_user_id INT
)
BEGIN
    DECLARE from_currency VARCHAR(3);
    DECLARE to_currency VARCHAR(3);
    DECLARE from_balance DECIMAL(15, 2);
    DECLARE sender_name VARCHAR(100);
    DECLARE receiver_name VARCHAR(100);
    DECLARE transaction_id INT;
    DECLARE converted_amount DECIMAL(15, 2);
    DECLARE exchange_rate DECIMAL(15, 6);
    
    -- Start transaction
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Check if source account exists and belongs to user
    SELECT 
        a.currency, 
        a.balance, 
        u.full_name INTO from_currency, from_balance, sender_name
    FROM 
        accounts a
        JOIN users u ON a.user_id = u.id
    WHERE 
        a.account_number = p_from_account 
        AND a.user_id = p_user_id
        AND a.is_active = TRUE;
    
    IF from_currency IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source account not found or not owned by user';
    END IF;
    
    -- Check if destination account exists
    SELECT 
        a.currency, 
        u.full_name INTO to_currency, receiver_name
    FROM 
        accounts a
        JOIN users u ON a.user_id = u.id
    WHERE 
        a.account_number = p_to_account
        AND a.is_active = TRUE;
    
    IF to_currency IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Destination account not found';
    END IF;
    
    -- Check if sufficient funds
    IF from_balance < p_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
    END IF;
    
    -- Set default exchange rate
    SET exchange_rate = 1.0;
    SET converted_amount = p_amount;
    
    -- Handle currency conversion if needed
    IF from_currency != to_currency THEN
        -- In a real system, you would call an external service or use a rates table
        -- For simplicity, we'll signal that this needs special handling
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Currency conversion requires special handling';
    END IF;
    
    -- Create transaction record
    INSERT INTO transactions (
        from_account,
        to_account,
        amount,
        original_amount,
        original_currency,
        currency,
        exchange_rate,
        explanation,
        sender_name,
        receiver_name,
        status,
        is_external
    ) VALUES (
        p_from_account,
        p_to_account,
        converted_amount,
        p_amount,
        from_currency,
        to_currency,
        exchange_rate,
        p_explanation,
        sender_name,
        receiver_name,
        'completed',
        FALSE
    );
    
    SET transaction_id = LAST_INSERT_ID();
    
    -- Update account balances
    UPDATE accounts 
    SET balance = balance - p_amount 
    WHERE account_number = p_from_account;
    
    UPDATE accounts 
    SET balance = balance + converted_amount 
    WHERE account_number = p_to_account;
    
    -- Log the action
    INSERT INTO logs (
        user_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_user_id,
        'TRANSFER',
        'transaction',
        transaction_id,
        JSON_OBJECT(
            'from', p_from_account,
            'to', p_to_account,
            'amount', p_amount,
            'currency', from_currency
        )
    );
    
    -- Commit transaction
    COMMIT;
    
    -- Return the transaction ID
    SELECT transaction_id;
END //
DELIMITER ;

-- Procedure to process external (incoming) transaction
DELIMITER //
CREATE PROCEDURE process_external_transaction(
    IN p_from_account VARCHAR(50),
    IN p_to_account VARCHAR(50),
    IN p_amount DECIMAL(15, 2),
    IN p_original_amount DECIMAL(15, 2),
    IN p_original_currency VARCHAR(3),
    IN p_currency VARCHAR(3),
    IN p_exchange_rate DECIMAL(15, 6),
    IN p_explanation VARCHAR(255),
    IN p_sender_name VARCHAR(100),
    IN p_reference_id VARCHAR(100)
)
BEGIN
    DECLARE to_currency VARCHAR(3);
    DECLARE receiver_name VARCHAR(100);
    DECLARE transaction_id INT;
    
    -- Start transaction
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Check if destination account exists
    SELECT 
        a.currency, 
        u.full_name INTO to_currency, receiver_name
    FROM 
        accounts a
        JOIN users u ON a.user_id = u.id
    WHERE 
        a.account_number = p_to_account
        AND a.is_active = TRUE;
    
    IF to_currency IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Destination account not found';
    END IF;
    
    -- Verify the currency matches the account
    IF p_currency != to_currency THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Currency mismatch with destination account';
    END IF;
    
    -- Create transaction record
    INSERT INTO transactions (
        from_account,
        to_account,
        amount,
        original_amount,
        original_currency,
        currency,
        exchange_rate,
        explanation,
        sender_name,
        receiver_name,
        status,
        is_external,
        reference_id
    ) VALUES (
        p_from_account,
        p_to_account,
        p_amount,
        p_original_amount,
        p_original_currency,
        p_currency,
        p_exchange_rate,
        p_explanation,
        p_sender_name,
        receiver_name,
        'completed',
        TRUE,
        p_reference_id
    );
    
    SET transaction_id = LAST_INSERT_ID();
    
    -- Update destination account balance
    UPDATE accounts 
    SET balance = balance + p_amount 
    WHERE account_number = p_to_account;
    
    -- Log the action
    INSERT INTO logs (
        user_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        NULL, -- System action
        'EXTERNAL_TRANSFER',
        'transaction',
        transaction_id,
        JSON_OBJECT(
            'from', p_from_account,
            'to', p_to_account,
            'amount', p_amount,
            'originalAmount', p_original_amount,
            'currency', p_currency,
            'originalCurrency', p_original_currency
        )
    );
    
    -- Commit transaction
    COMMIT;
    
    -- Return the transaction ID and receiver name
    SELECT transaction_id, receiver_name;
END //
DELIMITER ;

-- Function to get user's total balance across all accounts
DELIMITER //
CREATE FUNCTION get_user_total_balance(
    p_user_id INT,
    p_currency VARCHAR(3)
) RETURNS DECIMAL(15, 2)
DETERMINISTIC
BEGIN
    DECLARE total_balance DECIMAL(15, 2) DEFAULT 0;
    
    -- Get sum of balances for accounts in the specified currency
    -- In a real system, you would convert all balances to the specified currency
    SELECT SUM(balance) INTO total_balance
    FROM accounts
    WHERE user_id = p_user_id
    AND currency = p_currency
    AND is_active = TRUE;
    
    RETURN IFNULL(total_balance, 0);
END //
DELIMITER ;