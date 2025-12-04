var Params = {"surface_bottom":21.4, "surface_top":22.9, "surface_range":0.5, "room_bottom":22.5, "Cycle_base":1, "Cycle_Interval":0, "max_interval":90,"vtemp":[30,29,30,30,27,27,32],"vtime":[2, 2, 2, 1, 2, 2, 1],"current":{"time":"","room":"","surface":""}}
Params.Cycle_Interval = Params.Cycle_base

var Run_Group = 0;
var Vgroup = [0,1,2,3,4,5,6];

var Valve = [];
var LOW_TEMP = 24;
var NUM_VALVES=7

var next_wakeup = ""
const axios = require('axios');
const fs = require('fs')
const mymqtt = require('./mymqtt.js')
util = require('util')
const { format } = require('date-fns');

async function do_valve(cmd, valve) {
  try {
    // GET 요청
    const getResponse = await axios.get(`http://localhost:5000/${cmd}/${valve}`);
    console.log('do_valve:', getResponse.data);

  } catch (error) {
    console.error('do_valve Error:', error.message);
  }
}

heat_delay={'active':0, 'surface':0,'delay':0, 'mark':[0,0]}

fs.readFile('PARAMS.CF', function(err, data) {
    if (err) {
        throw err
        console.log('failed to read PARAMS.CF. defaulted')
        console.log("%j", Params)
        return
    }

    try {
        Params = JSON.parse(data)
        Params.Cycle_Interval = 0
        console.log(Params)
    } catch(ex) {
        console.log(`failed to parse PARAMS.DF. defaulted: ${data}`)
        console.log("%j", Params)
    }
})


var express = require('express');
var app = express();

var xml2js = require('xml2js');
var parser = new xml2js.Parser();

var EventEmitter = require('events').EventEmitter;
var got_temp = new EventEmitter();
var schedule = new EventEmitter();
var do_heating = new EventEmitter();

var m = {"ftemp":0, "temp":0};
var valve


easy = function(ms) {
    const diffInSeconds = Math.abs(diffInMs / 1000);
    if (diffInSeconds<60) return `${diffInSeconds.toFixed(1)}초전`
    const diffInMinutes = Math.abs(diffInMs / (1000 * 60));
    if (diffInMinutes<60) return `${diffInMinutes.toFixed(1)}분전`
    const diffInHours = Math.abs(diffInMs / (1000 * 60 * 60));
    if (diffInHours<24) return `${diffInHours.toFixed(1)}시간전`
}

get_temp = function() {
    s=''
    for(x in values) {
        diffInMs =new Date() - new Date(values[x]['time'])
        if (diffInMs>11000)
            s +=` ${x}:${easy(diffInMs)}`
    }
    if (s!='') console.log(`센서시간체크: ${s}`)
    body = values
    
    if ("3" in body) Params.current.room = room = parseFloat(body["3"]["3T0"]);
    else {
        console.log('no sensor data from 3')
        Params.current.room = room = 24
    }
    if ("122" in body) Params.current.surface = surface = parseFloat(body["122"]["122T0"]);
    else {
        console.log('no sensor data from 122')
        Params.current.surface = surface = 22
    }
    if ("31" in body) Params.current.room2 = room2 = parseFloat(body["31"]["31T0"]);
    else {
        console.log('no sensor data from 31')
        Params.current.room2 = room2 = 22
    }
    if("73" in body) Params.current.outside = m.temp = parseFloat(body["73"]["73T0"]);
    else {
        console.log('no sensor data from 73')
        Params.current.outside = m.temp = Params.current.room
    }
    Params.current.roomdiff = (Params.current.room - Params.current.room2).toFixed(2);
}


// 사이클이 실행되니 않고있을때, 10분마다 실행
do_heating.on('run', function(reason) {
    console.log(`trying heat from ${reason}`)
    if (running() > 0) {
        console.log("one_heating_cycle: already running. ignored.");
        return;
    }

    //ZZ
    get_temp()
    doit = false;
    dontdoit = false;
    doitforce = false;
    s = "";
    son = "";
    soff = "";
    
    d = new Date();
    hh = d.getHours();
    mm = d.getMonth() + 1;
    dd = d.getDate();
    
    if (room < Params.room_bottom) {
        doit = true;
        son += `Room cold ${room} < ${Params.room_bottom} `;
    }
    if (room2 < Params.room2_bottom) {
        doit = true;
        son += `Room2 cold ${room2} < ${Params.room2_bottom} `;
    }
    if (surface < Params.surface_bottom) {
        doit = true;
        son += `Surface cold ${surface} < ${Params.surface_bottom}`;
    }
    
    if (room > Params.room_top) {
        dontdoit = true;
        soff += `Room hot ${room} > ${Params.room_top} heating cancelled. `;
    }
    if (room2 > Params.room2_top) {
        dontdoit = true;
        soff += `Room2 hot ${room2} > ${Params.room2_top} heating cancelled. `;
    }
    if (surface > Params.surface_top) {
        dontdoit = true;
        soff += `Surface hot ${surface} > ${Params.surface_top} heating cancelled. `;
    }
    if (Params.current.roomdiff > Params.roomdiff) {
        doit = true;
        son += `room(3T0)-room2(31T0)=${room}-${room2}=${(room-room2).toFixed(2)} > 2 ( `;
    }
    if (false && Params.current.outside < 4 && Params.predict < Params.predict_ref) {
        doit = true;
        son += `temp in 4 hours ${Params.predict} < ${Params.predict_ref}`;
    }
    
    months = new Set([3, 4, 5, 10]);
    hours = new Set([0, 1, 2, 3, 4, 18, 19, 20, 21, 22, 23]);
    if (false && months.has(mm) && !hours.has(hh)) {
        dontdoit = true;
        soff = `Out of warm season time slot ${mm}/${dd} ${hh}:00 `;
    }
    
    Params.Cycle_base = 10;
    
    if (doit) {
        if (!dontdoit || dontdoit && doitforce) {
            if (dontdoit) m1=(`Forced Heating: ${son} outside=${m.temp} `);
            else m1=(`Heating: ${son} outside=${m.temp}`);
            console.log(m1)
            j={"msg":m1}
            mymqtt.publish(`ek/valvegod/valve/run`, JSON.stringify(j))
            next_wakeup = "";
            schedule.emit('run', 'new.cycle');
            p = `0W${Params.Cycle_Interval}`;
    
            Params.Cycle_Interval = 0;
        } else
        if (dontdoit) {
            console.log(`Cancelled Heating: ${son} ${soff} outside=${m.temp}`);
            console.log(`add ${Params.Cycle_base} min, last interval=${Params.Cycle_Interval}m`);
            next_cycle("surface_temp", Params.Cycle_base);
            Params.Cycle_Interval += Params.Cycle_base;
        }
    } else {
        timecheck = Params.max_interval + Params.current.outside * 5;
        Params.current.timecheck = timecheck;
        if (Params.current.outside < Params.activate_temperature && Params.Cycle_Interval > timecheck) {
            son += `${Params.Cycle_Interval} > ${timecheck}= (${Params.max_interval} + ${Params.current.outside}*10)`;
            console.log(`Too long interval heating: last interval=${Params.Cycle_Interval}m ${Params.Cycle_Interval}>${timecheck} and ${Params.current.outside} < ${Params.activate_temperature}\n`);
            next_wakeup = "";
            schedule.emit('run', 'new.cycle');
            Params.Cycle_Interval = 0;
        } else {
            console.log(`No Heating: Surface= ${surface} (+${(surface - Params.surface_bottom).toFixed(1)}) wait another ${Params.Cycle_base} min, last interval=${Params.Cycle_Interval}m timecheck=${timecheck}m\n${son}`);
            next_cycle("surface_temp", Params.Cycle_base);
            Params.Cycle_Interval += Params.Cycle_base;
        }
    }
    console.log(`%j 실내온습도=${m.temp}`, Params);
})

function next_cycle(from, t) {
    var d2 = new Date();
    d2 = new Date(d2.getTime() + (t * 60 * 1000));

    if (next_wakeup!="")
        console.log(`next wake up (from ${from}): ${format(next_wakeup, 'HH:mm:ss')} => ${format(d2, 'HH:mm:ss')}`);
    else
        console.log(`next wake up (from ${from}): none => ${format(d2, 'HH:mm:ss')}`);
    next_wakeup = d2
}

app.get('/Params/:where/:what', function(req, res) {
    where = req.params.where
    what = req.params.what

    console.log(`org: ${JSON.stringify(Params)}`)

    Params[where] = JSON.parse(what)
    fs.writeFile('PARAMS.CF', JSON.stringify(Params), (err) => {
        if (err) throw err 
    })
    console.log(JSON.stringify(Params))
    res.writeHead(200, {'Content-Type': 'text/plain'});
    s= JSON.stringify(Params, null, 4)
    s+= `\nsurface_bottom: (trigger) (current)= ${Params.surface_bottom} ${Params.current.surface}`
    s+= `\nroom_bottom:    (trigger) (current)= ${Params.room_bottom} ${Params.current.room}`
    s+= `\nroom2_bottom:   (trigger) (current)= ${Params.room2_bottom} ${Params.current.room2}`
    s+= `\nroomdiff:   (trigger) (current)= ${Params.roomdiff} ${Params.current.roomdiff}`
    s+= `\npredict: (trigger) (current)= ${Params.predict_ref} ${Params.predict}`
    s+= `\n`
    s+= `${JSON.stringify(Params)}`
    res.end(`{X-ACK} ${s}`);
})

app.get('/sensor_tick', function(req, res) {
    var temp = (req.query.temp).split(",");
    //console.log("got temp: "+ temp);
    m['s0'] = parseFloat(temp[0]);
    m['s1'] = parseFloat(temp[0]);
    for (var v = 0; v < 7; v++) {
        Valve[v].temperature_old = Valve[v].temperature
        Valve[v].temperature = parseFloat(temp[v + 1]);
        m['s' + eval(v + 2)] = temp[v + 1]
    }
    got_temp.emit('new temp');
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end("{X-ACK} ok");
})

app.get('/predict', function(req, res) {
    Params.predict = parseFloat(req.query.value)
    console.log(`got predict ${Params.predict}`)
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end("{X-ACK} ok");
})

app.get('/', function(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end("{X-ACK} ok");
});

app.get('/fire/:v', function(req, res) {
    s = ""
    v = req.params.v

    if (v < 0 || v > Vgroup.length) {
        s += `Invalid number, Vgroup(${Vgroup.length}) = ${util.format(Vgroup).replace(/[\n ]/gi, "")}`
    } else {
        if (v == Vgroup.length) {
            console.log(`cycle_end(STOP, ${Run_Group})`)
            cycle_end("STOP", Run_Group)
            Run_Group = 0
        } else {
            Run_Group = Vgroup[v]
            s += `Fired. Run_Group=${Run_Group} ${util.format(Vgroup).replace(/[\n ]/gi, "")}`
            schedule.emit('run', 'fire new.cycle from web');
        }
    }

    res.send(s);
    console.log(s)
});

app.get('/fireone/:v', function(req, res) {
    s = ""
    v = req.params.v

    if (v < 0 || v > Vgroup.length) {
        s = `Invalid number, Vgroup(${Vgroup.length}) = ${util.format(Vgroup).replace(/[\n ]/gi, "")}`
    } else {
        Run_Group = Vgroup.length
        valve = v
        s = `Heat a single valve ${v}`
        cycle_begin(valve, Params.vtime[valve], Params.vtime_max[valve], Params.vtemp[valve]); //(Valve, min min, max min, temp)
    }

    res.send(s);
    console.log(s)
});

app.get('/update_weather', function(req, res) {
    console.log('update_weather=%j', req.query)
    r = req.query
    t = r.wtime;

    m.wtime = r.wtime //new Date(`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:00`)
    m.temp = parseFloat(r.temp).toFixed(2);
    m.ftemp = parseFloat(r.ftemp).toFixed(2);
    m.humidity = parseFloat(r.reh).toFixed(0);
    m.rainprob = parseFloat(r.pop).toFixed(0);
    m.cloud = parseFloat(r.sky).toFixed(0);
    m.wind = parseFloat(r.ws).toFixed(0);
    console.log(m);

    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end("X-ACK: update weather ok");
})

app.get('/get', function(req, res) {
    str = "";
    str += "\nRun_Group=" + Run_Group;
    str += "\nnext_wakeup=" + format(next_wakeup, 'HH:mm:ss');
    str += "\nweather=" + JSON.stringify(m);
    str += "\nfuture, current = " + m.ftemp + ", " + m.temp;
    str += "\n./set?run_group=5"
    str += JSON.stringify(Params)

    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end(str);
});

app.get('/wakeup/:m', function(req, res) {
    var s = "";

    var m = req.params.m
    if (m > 0) {
        s += `next_wakeup=${m}<br>`
        next_cycle("web", m);
    }
    s += `next_wakeup= ${next_wakeup}`
    res.send(s);
});

function running() {
    var cnt = 0;
    Valve.forEach(function(value) {
        if (value.cycle_progress > 0) cnt++;
    });
    return (cnt);
}

// v=[0,1,2,3,4,5,6,7]
function cycle_begin(v, min_time, max_time, cutoff_temp) {
    if (Valve[v].cycle_progress > 0) {
        console.log("cycle_begin: Cycle Overrun. return. valve=" + v);
        return;
    }

    do_valve("open", v)
    Valve[v].cycle_time_mark = process.hrtime();
    Valve[v].cycle_minobj_mark = setTimeout(cycle_min_timeout, min_time * 60 * 1000, v);
    Valve[v].cycle_maxobj_mark = setTimeout(cycle_max_timeout, max_time * 60 * 1000, v);
    Valve[v].min_time = min_time;
    Valve[v].max_time = max_time;
    Valve[v].cutoff_temp = cutoff_temp;
    Valve[v].cycle_time = 0;
    Valve[v].cycle_progress = 1;
    Valve[v].got_min_temp = 0;

    var str = `cycle_begin: V${v}, Min=${min_time} min, Max=${max_time} min, vtemp[${v}]=${Params.vtemp[v]} <--${JSON.stringify(Params.vtemp)} C`;
    console.log(str);
    j={'status':'open', 'time':format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
    mymqtt.publish(`ek/valvegod/valve/${v}/open`, JSON.stringify(j))
}

function cycle_min_timeout(v) {
    if (Valve[v].cycle_progress <= 0) {
        console.log("cycle_min_timeout: invalid timeout. return. valve=" + v);
        return;
    }

    Valve[v].cycle_minobj_mark = 0;
    Valve[v].cycle_progress = 2;
    var str = "cycle_min_timeout: V" + v;
    console.log(str);
    check_valve_temperature();
}

function cycle_max_timeout(v) {
    if (Valve[v].cycle_progress <= 0) {
        console.log("cycle_max_timeout: invalid timeout. return. valve=" + v);
        return;
    }
    Valve[v].cycle_maxobj_mark = 0;
    Valve[v].cycle_progress = 3;

    cycle_end("TIMEOUT", v);
}

function cycle_hot(v) {
    if (Valve[v].cycle_progress <= 0) {
        console.log("cycle_hot: invalid timeout. return. valve=" + v);
        return;
    }
    if (!Valve[v].got_min_temp) {
        //console.log("cycle_hot: no flow yet, waiting further. valve="+ v);
        //return;
    }

    if (Valve[v].cycle_progress == 1) clearTimeout(Valve[v].cycle_minobj_mark);
    if (Valve[v].cycle_progress == 2) clearTimeout(Valve[v].cycle_maxobj_mark);
    Valve[v].cycle_progress = 3;

    cycle_end("HOT", v);
}

function cycle_end(why, v) {
    if (Valve[v].cycle_progress != 3) {
        console.log(`cycle_end: Valve[${v}] is not running `);
        return 0;
    }
    do_valve("close", v)
    j={'status':'closed', 'duration':ss, 'time':format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
    mymqtt.publish(`ek/valvegod/valve/${v}/close`, JSON.stringify(j))

    var ss = process.hrtime(Valve[v].cycle_time_mark)[0];
    //console.log("ss="+ ss);
    var mm = parseInt(ss / 60);
    var s2 = ss - mm * 60;
    Valve[v].cycle_time = ss;
    Valve[v].cycle_progress = -1;

    var str = "cycle_end: " + why + " V" + v + ", " + mm + "." + s2 + " mm.ss";
    console.log(str);

    if (false && m.s0 < 41) {
        console.log(`supplying temperature too low ${m.s0}. skip remaining cycle`)
        Run_Group = Vgroup.length
    }
    if (!running())
        schedule.emit('run', 'next.valve');
}

function record_cycle_stat() {
    var total_cycle_time = 0;
    var s = " ";
    var p = "";
    var comma = '';
    j={}
    Valve.forEach(function(Val, v) {
        j[`60001Z${v}`]=Val.cycle_time

        s += String(Val.cycle_time) + " ";
        if (Val.cycle_time) {
            p += comma + v + "Z" + (Val.cycle_time / 60.).toFixed(2);
            comma = ',';
            total_cycle_time += Val.cycle_time;
        }
    });
    j[`60001Z9`]=total_cycle_time
    j['time']= format(new Date(), "yyyy-MM-dd HH:mm:ss")
    console.log('%j', j);
    mymqtt.publish('ek/valvegod/60001', JSON.stringify(j) )
}

function check_valve_temperature() {
    Valve.forEach(function(Val, v) {
        var v_temp = Valve[v].temperature;
        if (!Valve[v].got_min_temp && v_temp <= LOW_TEMP) {
            Valve[v].got_min_temp = 1;
            //console.log("Check valve temperature: Valve["+ v +"] got low temp");
        }
        if (Val.cycle_progress <= 0) return;
        if (Val.min_time * 60 > process.hrtime(Val.cycle_time_mark)[0]) return;
        if (Val.cutoff_temp > v_temp) return;

        //console.log("Check temp: Max "+ Valve[v].max_time +" mm, "+ process.hrtime(Valve[v].cycle_time_mark)[0] +", Valve["+v+"].temperature="+ Valve[v].temperature);
        cycle_hot(v);
    });
}

got_temp.on('new temp', function() {
    get_temp()
    m.tdate = new Date();
    //console.log('m=%j', m);
    field_str = ""
    value_str = ""
    comma = ""
    for (var field in m) {
        field_str += comma + field
        if (field == "tdate") value_str += comma + "'" + format(m[field], "yyyy-MM-dd HH:mm:ss") + "'"
        //else if (field == "wtime") value_str += comma + "'"+ format(m[field], "yyyy-MM-dd HH:mm:ss") +"'"
        else if (field == "wtime") value_str += comma + m[field]
        else value_str += comma + "'" + m[field] + "'"
        comma = ","
    }

    var str = "got_temp: " + Math.floor(m.s0) + "/";
    j={}
    var p = "9T" + m["s0"] + ",7T" + m.temp + ",8T" + m.ftemp;
    j['60000T7']=m.temp
    j['60000T8']=m.ftemp
    j['60000T9']=m['s0']
    for (var v = 0; v < Valve.length; v++) {
        j[`60000T${v}`]=Valve[v].temperature
        if (Valve[v].cycle_progress <= 0) {
            str += " (" + Math.floor(Valve[v].temperature) + ")";
            p += "," + v + "T" + Valve[v].temperature;
        } else {
            str += "  " + Math.floor(Valve[v].temperature) + " ";
            delta = Valve[v].temperature - Valve[v].temperature_old
            if (delta > 0) t1 = `+${delta.toFixed(2)}`
            else if (delta == 0) t1 = ` ${delta.toFixed(2)}`
            else t1 = `${delta.toFixed(2)}`
            str += t1
            p += "," + v + "T" + Valve[v].temperature;
        }
    }
    j['time']= format(new Date(), "yyyy-MM-dd HH:mm:ss")
    mymqtt.publish('ek/valvegod/60000', JSON.stringify(j) )

    if (running() <= 0) {
        if (next_wakeup != "") {
            //console.log(">> "+ next_wakeup +", "+ format(next_wakeup, "yyyy-MM-dd HH:mm:ss"));
            diff = next_wakeup.getTime() - (new Date()).getTime();
            if (diff instanceof Error) {
                console.log(str + format(m.tdate, "yyyy-MM-dd HH:mm:ss") + m.temp + " -> error " + next_wakeup);
            } else {
                diffsecs = parseInt(diff / 1000);
                diffmins = parseInt(diffsecs / 60);
                diffhrs = parseInt(diffmins / 60);
                diffmins = parseInt(diffmins % 60);
                if (diffhrs > 0) hs = diffhrs + "h";
                else hs = "";
                if (diffmins) console.log(`${str} ${format(m.tdate, "HH:mm:ss")} 실내=${Params.current.room} 외부=${Params.current.outside} 방바닥=${Params.current.surface} -> ${format(next_wakeup, "HH:mm:ss")} ${hs+diffmins} min`)
                else console.log(`${str} ${format(m.tdate, "HH:mm:ss")} 실내=${Params.current.room} 외부=${Params.current.outside} 방바닥=${Params.current.surface} -> ${format(next_wakeup, "HH:mm:ss")} (${hs + diffsecs} sec)`);
            }
        }
    } else
        console.log(`${str} ${format(m.tdate, "yyyy-MM-dd HH:mm:ss")} 실내=${Params.current.room} 외부=${Params.current.outside} 방바닥=${Params.current.surface}`);

    check_valve_temperature();
});

// 이부분은 실제 밸브사이클 시작시키는 부분
schedule.on('run', function(from) {
    get_temp()

    if (Run_Group == 0) {
        do_reset = 1;
        if (heat_delay.active) {
            if (process.hrtime(heat_delay.mark)[0] < 60 * 40) {
                console.log(`heat_delay active, but waiting further. so far passed ${process.hrtime(heat_delay.mark)[0] / 60}min`);
                do_reset = 0;
            } else {
                console.log(`heat_delay active, waited too much. Reset this. So far passed ${process.hrtime(heat_delay.mark)[0] / 60}min`);
            }
        }
        if (do_reset) {
            heat_delay.active = 1;
            heat_delay.surface = 0;
            heat_delay.delay = 0;
            heat_delay.mark = 0;
        }
    }
    
    h = heat_delay;
    if (h.active) {
        if (h.surface == 0) {
            h.surface = Params.current.surface;
            h.mark = process.hrtime();
            console.log(`heat_delay-start: temp= ${h.surface}`);
        } else {
            if (Params.current.surface > h.surface) {
                h.delay = process.hrtime(h.mark)[0].toFixed(0) / 60;
                h.active = 0;
                console.log(`heat_delay-end: delay= ${h.delay}`);
            }
        }
    }

    console.log("scheduler: from " + from);
    for (var v = 0; v < 7; v++) Valve[v].temperature_old = Valve[v].temperature

    console.log("Vgroup.length=" + Vgroup.length + ", Run_Group=" + Run_Group);
    //if (Run_Group == Vgroup.length) {
    if (Run_Group == Vgroup.length) {

        Run_Group = 0;
        record_cycle_stat();
        next_cycle("run", 0);
        console.log("Closing cycle");
        //Vgroupindex++
        //Vgroupindex = Vgroupindex>2?0:Vgroupindex
        //Vgroup = Vgroups[Vgroupindex]

    } else {
        valve = Vgroup[Run_Group];
        //valve = Run_Group;
        cycle_begin(valve, Params.vtime[valve], Params.vtime_max[valve], Params.vtemp[valve]); //(Valve, min min, max min, temp)
        Run_Group++;
    }
});

function start() {
    for (var v = 0; v < NUM_VALVES; v++) {
        var Vobj = new Object();
        Vobj.cycle_time_mark = [-1, -1];
        Vobj.cycle_minobj_mark = -1;
        Vobj.cycle_maxobj_mark = -1;
        Vobj.cycle_progress = -1;
        Vobj.cycle_time = 0;
        Vobj.temperature = -1;
        Vobj.temperature_old = -1;
        Valve.push(Vobj);
    }
    next_cycle("start", 0);

    var server = app.listen(8080, function() {
        var host = server.address().address;
        var port = server.address().port;
        console.log("Listening on http://%s:%s", host, port);
    })
}

function clock() {
    var d = new Date();
    //console.log(`do_heating: now ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}, next_wakeup ${format(next_wakeup, "yyyy-MM-dd HH:mm:ss")}`)
    if (running() <= 0 && next_wakeup && next_wakeup < d) {
       //console.log(`do_heating.emit: by clock ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`)
       do_heating.emit('run', 'clock')
    }
    setTimeout(clock, 10000)
}

console.log("\n");
console.log("\n==========================================================");
m1=(`Valve God Start at ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`);
console.log(m1)
j={"msg":m1}
mymqtt.publish(`ek/valvegod/valve/run`, JSON.stringify(j))

for(var v=0;v<7;v++) {
    j={'status':'closed', 'time':format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
    mymqtt.publish(`ek/valvegod/valve/${v}`, JSON.stringify(j))
}


//m.temp = 15.0
//m.ftemp = 15.0
setTimeout(clock, 10000)
start();

//wcmd = "/usr/bin/python3 /home/pi/Valvegod/UpdateWeather/update_weather.py";

