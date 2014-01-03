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
	function getUnhandledIndex(session, method, path) {
		var index = -1;
		for (var i = 0; i < session.unhandled.length && index == -1; i++) {
			if (session.unhandled[i].method == method && session.unhandled[i].path == path) {
				index = i;
			}
		}
		return index;
	}
	function getUnhandled(session, method, path) {
		return session.unhandled[getUnhandledIndex(session, method, path)];
	}
	function removeUnhandled(session, method, path) {
		session.unhandled.splice(getUnhandledIndex(session, method, path), 1);
	}


	//-------------------
	// Session object
	//-------------------
	// Constructor.
	var Session = function(port, callback) {
		this.port = port;
		this.id = sessionIdCounter++;
		console.log("New session(" + this.id + "): " + port);
		sessions.push(this);
		this.requests = [];
		this.unhandled = [];

		// Initialize session server
		this.server = restify.createServer();
		this.server.use(restify.queryParser());
		// this.server.use(restify.bodyParser({ mapParams: false }));
		// this.server.use(handleSessionRequest);
		this.server.get("/.*/", function(req, res, next) {
			console.log("Got request, passing it on: " + req.method + " " + req.path());
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
		console.log("Disconnecting session " + this.id);
		this.server.close();
		removeSession(this.id);
		if (callback) {
			callback(null, this);
		}
	};

	// Expect a request
	Session.prototype.expect = function(options, callback) {
		var cb = callback;
		var id = requestIdCounter++;
		var request = {
			id: id,
			method: options.method,
			path: options.path,
		};
		request.callback = function(err, req) {
			var r = getRequest(this, id);
			if (!r.timeout) {
				console.log("Response to request " + r.id + ": " + req);
				r.done = true;
				if (cb) {
					cb(null, {id: this.id, body: req, what: "this"});
				}
			}
		}.bind(this);
		this.requests.push(request);
		console.log("Expecting (" + this.id + ":" + id + "): " + JSON.stringify(options));
		// Check if the expectation has already been fulfilled
		var unhandled = getUnhandled(this, options.method, options.path);
		if (unhandled) {
			console.log("Expectation already fulfilled!");
			unhandled.done = true;
			request.req = unhandled.req;
			request.res = unhandled.res;
			request.callback(null, unhandled.req.body);
			// Timeout response (if soapUI doesn't send response body in time)
			setTimeout(function() {
				if (!request.done) {
					console.log("Sending timeout response for request " + request.id);
					request.timeout = true;
					unhandled.res.send(408, "Timeout");
				}
			}.bind(this), 10000);
		}
		// Set a timeout in case this expectation isn't fulfilled in time
		setTimeout(function() {
			if (!request.done) {
				console.log("Expected request " + id + " didn't occur within timeout");
				cb({
					status: 408,
					body: "Expected request didn't occur within timeout"
				});
			}
		}, 10000);
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
	Session.prototype.handleRequest = function(req, res) {
		// Try to match with current expectations
		var request = null;
		for (var i = 0; i < this.requests.length && !request; i++) {
			if (this.requests[i].method == req.method && this.requests[i].path == req.path() && !this.requests[i].done && !this.requests[i].timeout) {
				request = this.requests[i];
			}
		}
		if (request) {
			// We matched an expected request, send body to soapUI
			console.log("Matched incoming to existing expectation");
			request.req = req;
			request.res = res;
			request.callback(null, req.body);
			// Timeout response (if soapUI doesn't send response body in time)
			setTimeout(function() {
				if (!request.done) {
					console.log("Sending timeout response for request " + request.id);
					request.timeout = true;
					res.send(408, "Timeout");
				}
			}.bind(this), 10000);
		}
		else {
			// No expected requests yet. Keep on hold while waiting for soapUI to send expectation
			console.log("Unexpected request on session " + this.id + ": " + req.method + " " + req.path());
			var unhandled = {
				method: req.method,
				path: req.path(),
				req: req,
				res: res
			};
			this.unhandled.push(unhandled);
			// Timeout response (if soapUI doesn't send expectation in time)
			setTimeout(function() {
				if (!unhandled.done) {
					console.log("Sending timeout response for unhandled request " + req.method + " " + req.path());
					removeUnhandled(this, req.method, req.path());
					res.send(408, "Timeout (no expectation for " + req.method + " " + req.path());
				}
			}.bind(this), 10000);
		}
	};


	// Initialize server
	server = restify.createServer();
	server.use(restify.queryParser());
	server.use(restify.bodyParser({ mapParams: false }));

	// Create a new session
	server.post("/sessions", function(req, res, next) {
		new Session(req.body.port, function(err, result) {
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
	server.post("/sessions/:sid/requests", function(req, res) {
		var session = getSession(req.params.sid);
		session.expect(req.body, function(err, result) {
			if (! err) {
				res.send({request: result});
			}
			else {
				res.send(err.status, err.body);
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
