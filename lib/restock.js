//---------------------------------------------------------------------------
// REST mocker for soapUI
//---------------------------------------------------------------------------
"use strict";

//-------------
// Dependencies
//-------------
var restify = require("restify");

//-----------------------------------
// Global variables
//-----------------------------------
// Admin server, consumed by soapUI
var server;
// Concurrent soapUI sessions (each with a different port)
var sessions = [];
// id counter for sessions
var sessionIdCounter = 1;

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

//-------------------
// Session object
//-------------------
// Constructor.
var Session = function(port, callback) {
	this.port = port;
	this.id = sessionIdCounter++;
	sessions.push(this);
	callback(null, this);
};

// Return the resource type name
Session.prototype.disconnect = function(callback) {
	removeSession(this.id);
	callback(null, this);
};

//-----------------------------------
// Initialize and start agent process
//-----------------------------------
// Initialize server
// var server = restify.createServer();
// server.use(restify.queryParser());
// server.use(restify.bodyParser({ mapParams: false }));

// // Create a new session
// server.post("/rest/v1/session", function(req, res, next) {
// 	var session = new Session(req.params.port, function(err, result) {
// 		if (! err) {
// 			res.send({session: result});
// 		}
// 		else {
// 			next(new restify.InternalServerError("Could not create session", err));
// 		}
// 	})
// });

// // Disconnect a session
// server.del("/rest/v1/session/:id", function(req, res, next) {
// 	var session = getSession(req.params.id);
// 	session.disconnect(function(err, result) {
// 		if (! err) {
// 			res.send({session: result});
// 		}
// 		else {
// 			next(new restify.InternalServerError("Could not disconnect session", err));
// 		}
// 	})
// });

// // Start admin server
// server.listen(config.port, function() {
//   console.log("%s listening at %s", server.name, server.url);
// });

function start() {
	console.log("Hello World!");
    // if(process.argv.length > 2) {
    //     var myfile = process.argv[2];

    //     if(fs.existsSync(myfile)) {
    //         var content = fs.readFileSync(myfile, 'utf8');
    //         fs.writeFileSync(myfile, content.toUpperCase());
    //         console.log("Done");
    //     } else {
    //         console.log("File does not exist - " + myfile);
    //     }
    // } else {
    //     console.log("Pass on a file name/path");
    // }
}

exports.start = start;
