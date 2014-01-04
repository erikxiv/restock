# RESTock

*Mock REST interfaces using soapUI*.

## Table of Contents

* [Install and start](#install-and-start)

## Install and start

### Requirements

* node.js (see http://nodejs.org/)

### Download

> npm install -g restock

### Start

> restock \[-port 3390\]

## Example usage

### Expect a single request

#### Start session
```
POST localhost:3390/sessions
{"port": 3391}

200 OK
{"session": {"id": 1}}
```

#### Expect a request to list ducks
```
POST localhost:3390/sessions/1/expectations
{
    "method": "GET", 
    "path": "/ducks",
    "reply": {
        "status": 200,
        "body": {
            "ducks": []
        }
    }
}

200 OK
{"expectation": {"id": 1, ...}}
```

#### Send a duck request (note the port difference)
```
GET localhost:3391/ducks

200 OK
{"ducks": []}
```

#### Get results of session
```
GET localhost:3390/expectations

200 OK
{
    "fulfilled": true,
    "expectations": [
        {
            "id": 1,
            ...,
            "timeout": false,
            "fulfilled": true,
            "request": {
                "body": undefined
            }
        }
    ]
}
```

#### Disconnect session
```
DELETE localhost:3390/sessions/1

200 OK
```

