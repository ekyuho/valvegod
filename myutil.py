from datetime import datetime

VERSION='myutil.py 2024-11-24 V1.0'
#print(f'VERSION {VERSION}')

def d2s(d='', inform=''):
    if d=='': d=datetime.now()
    if isinstance(d, str):
        if inform: print(f'''{inform}: already str {d}''')
    else: d = datetime.strftime(d, '%Y-%m-%d %H:%M:%S')
    return d

def df2s(d='', inform=''):
    if d=='': d=datetime.now()
    if isinstance(d, str):
        if inform: print(f'''{inform}: already str {d}''')
    else: d = datetime.strftime(d, '%Y-%m-%d %H:%M:%S.%f')
    return d

