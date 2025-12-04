import RPi.GPIO as GPIO
import time
import json
from myutil import d2s
from RepeatedTimer import RepeatedTimer
import paho.mqtt.publish as publish
from collections import deque, Counter
queue = deque()

GPIO.setmode(GPIO.BCM)
GPIO_IN = 5   # 입력 핀
GPIO_OUT = 6  # 출력 핀
state=''
state_old=''
filpped=False
start=time.time()
value=''
cycle={}
q=[]

GPIO.setup(GPIO_IN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(GPIO_OUT, GPIO.OUT)
#GPIO.output(GPIO_OUT, sw)

def init():
    global start
    for i in range(20): 
        sense()
        time.sleep(0.1)

    counter = Counter(q)
    state=counter.most_common(1)[0][0]
    state_old=state
    start = time.time()
    print(d2s(), 'state=', state)
    if state:  GPIO.output(GPIO_OUT, 0)
    else: GPIO.output(GPIO_OUT, 1)


def sense():
    global q
    q.append(GPIO.input(GPIO_IN))

def main():
    global q, state,  state_old, flipped, start, value

    counter = Counter(q)
    state = counter.most_common(1)[0][0]
    if state_old==1 and state==0: #자석스위치 ON
        GPIO.output(GPIO_OUT, 1)
        t1 = time.time()-start
        print(d2s(), 'got pulse', round(value,2), f'+{t1:.0f} sec')
        start = time.time()
        value += 0.01
        with open('water.dat','w') as f: json.dump({"value":round(value,2)}, f)
        publish.single('ek/valvegod/heating', json.dumps({"value":round(value,2), "elspaed":round(t1,0), "time":d2s()}), hostname="damoa.io")
    if state_old==0 and state==1: #자석스위치 OFF
        GPIO.output(GPIO_OUT, 0)
    state_old=state
    q=[]

if __name__ == "__main__":
    with open('water.dat') as f: value=json.load(f).get('value')
    print(f'loaded value={value}')
    init()

    try:
        t1 = RepeatedTimer(0.01, sense)
        t2 = RepeatedTimer(1, main)
        # 프로그램이 계속 실행되도록
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n프로그램 종료")
        t1.stop()  # RepeatedTimer 정지
        t2.stop()  # RepeatedTimer 정지
    finally:
        GPIO.cleanup()
