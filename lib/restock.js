//---------------------------------------------------------------------------
// REST mocker for soapUI
//---------------------------------------------------------------------------
"use strict";

//-------------
// Dependencies
//-------------
var restify = require("restify");

//-----------------------------------
// Initialize and start agent process
//-----------------------------------

function start() {
	var port = 3390;
    if(process.argv.length > 2) {
        port = process.argv[2];
    }

	// Admin server, consumed by soapUI
	var server;
	// Concurrent soapUI sessions (each with a different port)
	var sessions = [];
	// id counter for sessions
	var sessionIdCounter = 1;
	var expectationIdCounter = 1;

	//-----------------------------------
	// Internal functions
	//-----------------------------------

	function getSessionIndex(id) {
		var index = -1;
		for (var i = 0; i < sessions.length && index == -1; i++) {
			if (sessions[i].id == id) {
				index = i;
			}
		}
		return index;
	}
	function getSession(id) {
		return sessions[getSessionIndex(id)];
	}

	//-------------------
	// Session object
	//-------------------
	// Constructor.
	var Session = function(port, callback) {
		this.port = port;
		this.id = sessionIdCounter++;
		this.fulfilled = true;
		this.active = true;
		this.expectations = [];
		this.expectationCallbacks = [];
		this.currentExpectationIndex = 0;
		this.requests = [];
		// this.requests = [];
		// this.unhandled = [];

		// Initialize session server
		console.log("[" + this.id + "] listening on port " + port);
		this.server = restify.createServer();
		this.server.use(restify.queryParser());
		this.server.use(restify.bodyParser());

	    // This will set the idle timer to 2 seconds
	    // For some reason it will otherwise take ages to close a server connection
	    // Probably due to connections not being closed properly by RESTock or RESTify...
		this.server.use(function (req, res, next) {
		    req.connection.setTimeout(2 * 1000);
		    res.connection.setTimeout(2 * 1000);
		    next();
		});

		// Listen to all incoming calls
		this.server.post("/.*/", function(req, res, next) {
			console.log("[" + this.id + "] " + req.method + " " + req.path());
			this.handleRequest(req, res, next);
		}.bind(this));
		this.server.get("/.*/", function(req, res, next) {
			console.log("[" + this.id + "] " + req.method + " " + req.path());
			this.handleRequest(req, res, next);
		}.bind(this));
		this.server.put("/.*/", function(req, res, next) {
			console.log("[" + this.id + "] " + req.method + " " + req.path());
			this.handleRequest(req, res, next);
		}.bind(this));
		this.server.del("/.*/", function(req, res, next) {
			console.log("[" + this.id + "] " + req.method + " " + req.path());
			this.handleRequest(req, res, next);
		}.bind(this));

		// Start session server
		this.server.listen(port, function() {
		  console.log("[" + this.id + "] listening at %s", this.server.url);
		});

		if (callback) {
			callback(null, this);
		}
	};

	// Disconnect session
	Session.prototype.disconnect = function(callback) {
		console.log("[" + this.id + "] disconnecting");
		// this.server.on("close", )
		this.server.close(function() {
			console.log("[" + this.id + "] disconnected");
			this.active = false;
			if (callback) {
				callback(null, this);
			}
		}.bind(this));
		// this.server.on("close",function() {
		// 	console.log("[" + this.id + "] disconnected (event)");
		// }.bind(this));
		// Hmmm..
		// var s = restify.createServer();
		// s.listen(this.server.port, function() {
		// 	console.log("temporarily listening to port");
		// 	http.get("http://localhost:"+this.server.port);
		// 	s.close();
		// }.bind(this));
	};

	// Expect a request
	Session.prototype.expect = function(expectation, callback) {
		this.fulfilled = false;
		// var cb = callback;
		// var sid = this.id;
		// Add some properties to the expectation and add it to the queue
		expectation.id = expectationIdCounter++;
		// var expectationCallback = function(err, req) {
		// 	// var r = getRequest(this, id);
		// 	if (!expectation.timeout) {
		// 		console.log("[" + sid + "," + expectation.id + "] Response: " + req);
		// 		expectation.fulfilled = true;
		// 		if (cb) {
		// 			cb(null, {id: sid, body: req, what: "this"});
		// 		}
		// 	}
		// }.bind(this);
		this.expectations.push(expectation);
		// this.expectationCallbacks.push(expectationCallback);
		console.log("[" + this.id + "," + expectation.id + "] expecting " + expectation.method + " " + expectation.path);
		callback(null, {expectation: expectation});
	};

	// List expectations
	Session.prototype.listExpectations = function(callback) {
		callback(null, {
			fulfilled: this.fulfilled,
			expectations: this.expectations
		});
	};

	// Incoming request
	Session.prototype.handleRequest = function(req, res, next) {
		var request = {
			method: req.method,
			path: req.path(),
			body: req.body
		};
		// Try to match with current expectations
		var expectation = this.expectations[this.currentExpectationIndex];
		if (!this.fulfilled &&
			expectation &&
			request.method == expectation.method &&
			request.path == expectation.path) {
			// Match!
			expectation.request = request;
			expectation.fulfilled = true;
			expectation.timeout = false;
			this.currentExpectationIndex++;
			if (this.currentExpectationIndex >= this.expectations.length) {
				this.fulfilled = true;
			}
			// Send response
			console.log("[" + this.id + "," + expectation.id + "] fulfilled");
			res.send(expectation.reply.status, expectation.reply.body);
			res.end();
			next();
		}
		else {
			// Fail, abort expectations
			this.fulfilled = false;
			this.currentExpectationIndex = -1;
			// Send error response
			console.log("[" + this.id + "] fail, did not expect " + request.method + " " + request.path);
			res.send(400, "No expectation for this request");
			res.end();
			next();
		}
	};


	// Initialize server
	server = restify.createServer();
	server.use(restify.queryParser());
	server.use(restify.bodyParser({ mapParams: false }));

	// Create a new session
	server.post("/sessions", function(req, res, next) {
		// Verify that the port is not in use
		var portIsFree = true;
		for (var i = 0; i < sessions.length; i++) {
			if (sessions[i].active && sessions[i].port == req.body.port) {
				portIsFree = false;
			}
		}
		if (! portIsFree) {
			res.send(400, "Port is already in use");
			return;
		}
		var session = new Session(req.body.port, function(err, result) {
			if (! err) {
				res.send({session: {
					id: result.id
				}});
			}
			else {
				console.log("Could not create session");
				console.log(err);
				next(new restify.InternalServerError("Could not create session: ", err));
			}
		});
		sessions.push(session);
		// Timeout session (if not disconnected in 60 seconds)
		setTimeout(function() {
			if (session.active) {
				session.disconnect(function() {
					console.log("[" + session.id + "] disconnected by timeout");
				});
			}
		}, 30000);
	});

	// Disconnect a session
	server.del("/sessions/:id", function(req, res, next) {
		var session = getSession(req.params.id);
		session.disconnect(function(err, result) {
			if (! err) {
				res.send({session: result.id});
			}
			else {
				next(new restify.InternalServerError("Could not disconnect session: ", err));
			}
		});
		// removeSession(req.params.id);
	});

	// Expect a request
	server.post("/sessions/:sid/expectations", function(req, res) {
		var session = getSession(req.params.sid);
		session.expect(req.body, function(err, result) {
			if (! err) {
				res.send(result);
			}
			else {
				res.send(err.status, err.body);
			}
		});
	});

	// List expectations (and results)
	server.get("/sessions/:sid/expectations", function(req, res) {
		var session = getSession(req.params.sid);
		if (! session) {
			throw new Error("No session with id " + req.params.sid);
		}
		session.listExpectations(function(err, result) {
			if (! err) {
				res.send(result);
			}
			else {
				res.send(err.status, err.body);
			}
		});
	});

	// Start admin server
	server.listen(port, function() {
	  console.log("RESTock listening at %s", server.url);
	});
}

exports.start = start;
