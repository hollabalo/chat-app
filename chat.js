var net = require('net');
var http = require('http');
var WebSocketServer = require('websocket').server;
var con = require('consolidate');
var users = {};

var tcpserver = net.createServer(function(socket) {
	var o = {};

	socket.write('Welcome! To set your nickname, please type:\n');
	socket.write('   Nickname: <your nickname>\n\n');

	socket.on('data', function(data) {
		var d = data.toString().split(" ");
		if(d[0].toLowerCase() == "nickname") {
			var client = d[1].substring(0, d[1].length - 2);
			registerUser(client, socket, function() {
				broadcast(client, "has joined\n\n");
			}, o);
		}
		else {
			if(d[0].toLowerCase() == "private") {
				privateMessage(d[1], o['nick'], data.toString());
			}
			else if(d[0].substring(0, d[0].length - 2) == "list") {
				socket.write('\n\nList of users using chat\n\n:');
				listUsers(function(u) {
					u.forEach(function(user) {
						socket.write(user+"\n");
					});
				});
			}
			else {
				broadcast(o['nick'], data.toString(), socket);
			}
		}
	});
	socket.on('error', function(err) {
		process.stdout.write(err.toString());
	});
	socket.on('end', function() {
		broadcast(o['nick'], "disconnected!", socket);
	})
});
tcpserver.listen(8000);

function broadcast(nickname, message, sender) {
	for(var key in users) {
		if(users[key]['socket'] === sender) {
			continue;
		}
		else {
			if(users[key]['socket'].write != null) {
				users[key]['socket'].write(nickname + ": " + message + "\n\r");
			}
			else {
				var ret = JSON.stringify({
					action : "chat",
				    nickname : nickname,
				    message : message + "\n\n"
				});
				users[key]['socket'].send(ret);
			}
		}
	}
}

function privateMessage(recipient, sender, message) {
	users[recipient]['socket'].write(sender + " " + message);
}

function listUsers(callback) {
	var u = [];
	for(var key in users) {
		u.push(key);
	}
	callback(u);
}

function registerUser(nickname, socket, callback, o) {
	if(!o) {
		o = {};
	}
	users[nickname] = o;
	o['nick'] = nickname;
	o['socket'] = socket;
	if(!!callback) {
		callback();
	}
}

var httpserver = http.createServer(function(req, res) {
	if(req.url == "/") {
		var users;
		listUsers(function(u) {
			users = u;
		});
		con.swig("views/index.html", { users: users },
			function(err, html) {
				res.writeHead(200, { "Content-Type" : "text/html"});
				res.end(html);	
			}
		);
	}
	else if(req.url == "/chat") {
		con.swig("views/nickname.html", {users: users },
			function(err, html) {
				res.writeHead(200, { "Content-Type" : "text/html"});
				res.end(html);
			}
		);
	}
}).listen(80);

var WebSocketServer = require('websocket').server;
wsServer = new WebSocketServer({httpServer : httpserver});
var nickname;
wsServer.on('request', function(request) {
	var connection = request.accept();
	connection.on('message', function(message) {
		var json = JSON.parse(message.utf8Data);
		nickname = json.nickname;
		if(json.action == "register") {
			var msg = "has joined";
			var ret = JSON.stringify({
				action :json.action,
			    nickname : nickname,
			    message : msg
			});
			registerUser(nickname, connection, function() {
				broadcast(nickname, msg, connection);
			});
			connection.send(ret);
		}
		else if(json.action == "chat") {
			broadcast(nickname, json.message, connection);
		}
	});

	connection.on('close', function(reasonCode, description) {
		delete users[nickname]; 
		broadcast(nickname, "disconnected!", connection);
	});
});

process.setgid("jmgerona");
process.setuid("jmgerona");
