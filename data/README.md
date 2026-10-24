# data/

Place the transactions file here as `transactions.csv` (it is not committed; see `.gitignore`).

Expected columns: transaction_id, customer_id, transaction_date, transaction_time, account_type, transaction_type, transaction_amount, transaction_direction, account_balance, merchant_category, state, credit_score, has_loan, loan_type, emi_amount, transaction_status, channel, kyc_status, is_fraud, transaction_hour.

The file must be sorted by transaction_date. If you have the `.csv.gz`, run `gunzip -k transactions.csv.gz` and rename the result.
