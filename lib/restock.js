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
	var requestIdCounter = 1;

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
	function removeSession(id) {
		sessions.splice(getSessionIndex(id), 1);
	}
	function getRequest(session, id) {
		var result;
		for (var i = 0; i < session.requests.length && !result; i++) {
			if (session.requests[i].id == id) {
				result = session.requests[i];
			}
		}
		return result;
	}


	//-------------------
	// Session object
	//-------------------
	// Constructor.
	var Session = function(port, callback) {
		console.log("New session: " + port);
		this.port = port;
		this.id = sessionIdCounter++;
		console.log("New session(" + this.id + "): " + port);
		sessions.push(this);
		this.requests = [];

		// Initialize session server
		this.server = restify.createServer();
		this.server.use(restify.queryParser());
		// this.server.use(restify.bodyParser({ mapParams: false }));
		// this.server.use(handleSessionRequest);
		this.server.get("/.*/", function(req, res, next) {
			console.log("Got request, passing it on: " + req);
			this.handleRequest(req, res, next);
		}.bind(this));

		// Start session server
		this.server.listen(port, function() {
		  console.log("Session " + this.id + " listening at %s", this.server.url);
		});

		if (callback) {
			callback(null, this);
		}
	};

	// Disconnect session
	Session.prototype.disconnect = function(callback) {
		removeSession(this.id);
		if (callback) {
			callback(null, this);
		}
	};

	// Expect a request
	Session.prototype.expect = function(options, callback) {
		var cb = callback;
		var request = {
			id: requestIdCounter++,
			method: options.method,
			path: options.path,
			callback: function(err, req) {
				console.log("In the rabbit hole");
				if (cb) {
					cb(null, {id: this.id, body: req, what: "this"});
				}
			}.bind(this)
		};
		this.requests.push(request);
		console.log("Waiting for request: " + JSON.stringify(options));
	};

	// Respond to a request
	Session.prototype.respond = function(requestId, options, callback) {
		var request = getRequest(this, requestId);
		request.res.send(options.status, options.body);
		if (callback) {
			callback(null, request);
		}
	};

	// Incoming request
	Session.prototype.handleRequest = function(req, res, next) {
		// Try to match with current expectations
		var request;
		console.log("request count: " + this.requests.length);
		for (var i = 0; i < this.requests.length && !request; i++) {
			console.log("method compare: " + this.requests[i].method + "==" + req.method);
			if (this.requests[i].method == req.method) {
				console.log("Matching method, that'll do");
				this.requests[i].req = req;
				this.requests[i].res = res;
				this.requests[i].next = next;
				this.requests[i].callback(null, req.body);
			}
		}
	};


	// Initialize server
	server = restify.createServer();
	server.use(restify.queryParser());
	server.use(restify.bodyParser({ mapParams: false }));

	// Create a new session
	server.post("/sessions", function(req, res, next) {
		console.log("New session requested");
		new Session(req.body.port, function(err, result) {
			if (! err) {
				console.log("New session created");
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
	});

	// Expect a request
	server.post("/sessions/:sid/requests", function(req, res, next) {
		var session = getSession(req.params.sid);
		session.expect(req.body, function(err, result) {
			if (! err) {
				res.send({request: result});
			}
			else {
				next(new restify.InternalServerError("Could not create request: ", err));
			}
		});
	});

	// Send a response to a request
	server.put("/sessions/:sid/requests/:rid", function(req, res, next) {
		var session = getSession(req.params.sid);
		session.respond(req.params.rid, req.body, function(err, result) {
			if (! err) {
				res.send({request: {
					id: result.id
				}});
			}
			else {
				next(new restify.InternalServerError("Could not respond to request: ", err));
			}
		});
	});

	// Start admin server
	server.listen(port, function() {
	  console.log("RESTock listening at %s", server.url);
	});
}

exports.start = start;
