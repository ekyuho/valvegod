const Gpio = require('pigpio').Gpio;

var w2b = [17, 18, 27, 22, 23, 24, 25, 4];
var pin = [];

function init_relay() {
    console.log('Initializing GPIO with pigpio...');
    
    for (let p = 0; p < w2b.length; p++) {
        console.log(`Initializing GPIO ${w2b[p]}...`);
        try {
            const gpio = new Gpio(w2b[p], { mode: Gpio.OUTPUT });
            gpio.digitalWrite(0); // 초기값 0 (OFF)
            pin.push(gpio);
            console.log(`✓ GPIO ${w2b[p]} initialized`);
        } catch (err) {
            console.error(`✗ Failed GPIO ${w2b[p]}: ${err.message}`);
        }
    }
    
    console.log(`\nInitialized ${pin.length}/${w2b.length} GPIO pins`);
    return pin.length > 0;
}

// GPIO 제어 함수들
function set_relay(index, value) {
    if (index < 0 || index >= pin.length) {
        console.error(`Invalid relay index: ${index}`);
        return;
    }
    pin[index].digitalWrite(value ? 1 : 0);
    console.log(`Relay ${index} (GPIO ${w2b[index]}) set to ${value ? 'ON' : 'OFF'}`);
}

function get_relay(index) {
    if (index < 0 || index >= pin.length) {
        return 0;
    }
    return pin[index].digitalRead();
}

// 모든 릴레이 끄기
function all_off() {
    pin.forEach((p, i) => {
        p.digitalWrite(0);
        console.log(`Relay ${i} OFF`);
    });
}

// 프로그램 종료 시 정리
function cleanup_and_exit() {
    console.log('\nCleaning up GPIO...');
    all_off();
    process.exit();
}

process.on('SIGINT', cleanup_and_exit);
process.on('SIGTERM', cleanup_and_exit);

// 초기화 실행
if (!init_relay()) {
    console.error('\n⚠️  GPIO initialization failed!');
    console.error('Make sure pigpiod is running: sudo systemctl start pigpiod');
    process.exit(1);
}

// Export 함수들
module.exports = {
    init_relay,
    set_relay,
    get_relay,
    all_off,
    pin
};
