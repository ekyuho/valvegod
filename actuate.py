from gpiozero import LED
import argparse
import sys
from flask import Flask, jsonify, request

app = Flask(__name__)

pin= [17, 18, 27, 22, 23, 24, 25, 4]
relay=[]

def init():
    global relay
    for i in range(7): 
        m=LED(pin[i])
        relay.append(m)
        m.on()   # on이 닫는것

@app.route('/<cmd>/<int:valve>', methods=['GET'])
def _do(cmd, valve):
    print(f'{cmd} {valve}')
    if cmd=='open':
        m=relay[valve]
        m.off()
    elif cmd=='close':
        m=relay[valve]
        m.on()
    else:
        print('unknown ', cmd, valve)
    return 'X-OK'

if __name__ == "__main__":
    init()
    app.run()
