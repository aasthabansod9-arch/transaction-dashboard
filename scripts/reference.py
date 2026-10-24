"""Independent pandas calculation of headline figures, used to cross-check the dashboard.
Usage: python3 scripts/reference.py [path/to/transactions.csv]   -> build/reference.json
"""
import pandas as pd, numpy as np, json, sys, os
os.makedirs('build', exist_ok=True)
df = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else 'data/transactions.csv', keep_default_na=False, na_values=[''])
df['y']=df.transaction_date.str[:4].astype(int)
def kp(d):
    cr=d[d.transaction_direction=='Credit'].transaction_amount.sum()
    fr=d.transaction_status.isin(['Failed','Reversed'])
    return dict(cnt=len(d), val=round(d.transaction_amount.sum()*100), cred=round(cr*100), fN=int(d.is_fraud.sum()), fV=round(d[d.is_fraud==1].transaction_amount.sum()*100),
      frN=int(fr.sum()), frV=round(d[fr].transaction_amount.sum()*100), pendN=int((d.transaction_status=='Pending').sum()), cust=int(d.customer_id.nunique()),
      lnN=int(d.has_loan.sum()), emi=round(d[d.has_loan==1].emi_amount.sum()*100), median=float(d.transaction_amount.median()))
out={'2023':kp(df[df.y==2023]),'2022':kp(df[df.y==2022]),'all':kp(df[df.y<=2023])}
d=df[df.y==2023]
out['state2023']={k:[int(len(g)),round(g.transaction_amount.sum()*100),int(g.is_fraud.sum())] for k,g in d.groupby('state')}
out['ttype2023']={k:[int(len(g)),round(g.transaction_amount.sum()*100),int(g.is_fraud.sum())] for k,g in d.groupby('transaction_type')}
top=d.groupby('customer_id').transaction_amount.sum().sort_values(ascending=False).head(10)
out['top2023']=[[k,round(v*100)] for k,v in top.items()]
k=d[(d.kyc_status!='Verified')&(d.account_balance.round()>=1e6)]
out['khb2023']=dict(n=len(k), cust=int(k.customer_id.nunique()), val=round(k.transaction_amount.sum()*100))
l=d[d.has_loan==1]; r=l.emi_amount/np.round(l.account_balance)
out['stress2023']=[int(((r>=lo)&(r<hi)).sum()) for lo,hi in [(0,.05),(.05,.10),(.10,.25),(.25,.5),(.5,1e9)]]
out['acctmed2023']={k:float(g.transaction_amount.median()) for k,g in d.groupby('account_type')}
# filtered scenario: state in Maharashtra,Karnataka & ttype UPI,RTGS, 2021-03-01..2022-06-30
f=df[(df.state.isin(['Maharashtra','Karnataka']))&(df.transaction_type.isin(['UPI','RTGS']))&(df.transaction_date>='2021-03-01')&(df.transaction_date<='2022-06-30')]
out['scen']=kp(f)
json.dump(out,open('build/reference.json','w'))
print(out['2023'], out['scen'])
