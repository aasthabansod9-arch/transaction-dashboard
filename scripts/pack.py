"""Pack the transactions CSV into a compressed, column-wise binary for the dashboard.

Usage: python3 scripts/pack.py [path/to/transactions.csv]   (default: data/transactions.csv)
Writes build/data.b64 and build/meta.json.
"""
import pandas as pd, numpy as np, json, zlib, base64, sys, os
src = sys.argv[1] if len(sys.argv) > 1 else 'data/transactions.csv'
os.makedirs('build', exist_ok=True)
# keep_default_na=False so the loan_type value "None" stays a category and is not read as missing
df = pd.read_csv(src, keep_default_na=False, na_values=[''])
assert df.transaction_date.is_monotonic_increasing
base = pd.Timestamp('2019-01-01')
day = (pd.to_datetime(df.transaction_date) - base).dt.days.values.astype(np.uint16)
def enc(col, order=None):
    cats = order or sorted(df[col].unique(), key=str)
    m = {c:i for i,c in enumerate(cats)}
    return df[col].map(m).values.astype(np.uint8), cats
acct, acctL = enc('account_type', ['Savings','Current','Salary','NRI','Fixed Deposit'])
ttype, ttypeL = enc('transaction_type', ['UPI','IMPS','NEFT','RTGS','POS','ATM_Withdrawal','Net_Banking','Auto_Debit','Cheque','Credit_Card'])
state, stateL = enc('state')
chan, chanL = enc('channel', ['Mobile_App','Web','ATM','POS_Terminal','Branch','API'])
merch, merchL = enc('merchant_category')
df['loan_cat']=df.loan_type.where(~((df.has_loan==1)&(df.loan_type=='None')),'Unclassified')
df.loc[df.loan_cat=='None','loan_cat']='None'
loan, loanL = enc('loan_cat', ['None','Home','Personal','Auto','Business','Education','Gold','Unclassified'])
kyc, kycL = enc('kyc_status', ['Verified','Pending','Expired'])
status, statusL = enc('transaction_status', ['Success','Failed','Reversed','Pending'])
dire, dirL = enc('transaction_direction', ['Credit','Debit'])
fraud = df.is_fraud.values.astype(np.uint8)
hour = df.transaction_hour.values.astype(np.uint8)
score = df.credit_score.values.astype(np.uint16)
cust = df.customer_id.str[4:].astype(int).values.astype(np.uint32)
paise = lambda s: np.round(s.values*100).astype(np.uint32)
amt, bal, emi = paise(df.transaction_amount), np.round(df.account_balance.values).astype(np.uint32), paise(df.emi_amount)
assert (loan>0).sum()==df.has_loan.sum()
def planes(a):
    a = np.ascontiguousarray(a)
    b = a.view(np.uint8).reshape(len(a), a.dtype.itemsize)
    return b.T.copy().tobytes()   # byte-plane shuffle
cols = [('day',day),('cust',cust),('amt',amt),('bal',bal),('emi',emi),('score',score),
        ('acct',acct),('ttype',ttype),('state',state),('chan',chan),('merch',merch),('loan',loan),
        ('kyc',kyc),('status',status),('dir',dire),('fraud',fraud),('hour',hour)]
blob = b''.join(planes(a) for _,a in cols)
meta = dict(n=len(df), cols=[[n, str(a.dtype), a.dtype.itemsize] for n,a in cols],
  epoch='2019-01-01', labels=dict(acct=acctL,ttype=ttypeL,state=stateL,chan=chanL,merch=merchL,loan=loanL,kyc=kycL,status=statusL,dir=dirL))
co = zlib.compressobj(9, zlib.DEFLATED, -15)  # raw deflate
z = co.compress(blob)+co.flush()
print(len(blob), len(z), len(z)*4/3/1e6, 'MB base64')
open('build/data.b64','w').write(base64.b64encode(z).decode())
json.dump(meta, open('build/meta.json','w'))
