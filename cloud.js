const axios = require('axios');
var S1 = 0;
var S2 = 0;

/*
module.exports = {
  call: function call(param) {

    var headers = {
        'User-Agent':       'Kim Agent/0.0.1',
        'Content-Type':     'application/x-www-form-urlencoded'
    };
    var options = {
      headers: headers,
      method: 'GET',
    };
   
    options.url = 'http://'+ 't.damoa.io' +':8080/logone?u=60000&s='+ S2++ +'&f=3&i=' + param;
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if (body.slice(0,5) != 'X-ACK') console.log(body); 
      } else
        console.log("no X-ACK: t.damoa.io "+ ""+body); 
    })
  }
}
*/

module.exports = {
  call: function call(param) {
    var headers = {
        'User-Agent': 'Kim Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    var url = 'http://t.damoa.io:8080/logone?u=60000&s=' + S2++ + '&f=3&i=' + param;
    
    axios.get(url, { headers: headers })
      .then(response => {
        if (response.status == 200) {
          const body = response.data;
          if (body.slice(0, 5) != 'X-ACK') console.log(body);
        }
      })
      .catch(error => {
        console.log("no X-ACK: t.damoa.io " + error.response?.data);
      });
  }
}

//call(22, 4, 22);

