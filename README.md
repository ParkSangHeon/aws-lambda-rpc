# aws-lambda-rpc
Call aws lambda function like RPC

# Use

## Step 1. Create lambda function

### index.js
```js
'use strict'

exports.handler = (event, context, callback) => {
    console.log("Receive event :", event);
    callback(null, 'Hello, World!');
}; // handler()
```

# Configuration

```js
{
    "development" : {
        "region" : "ap-northeast-2",
        "prefix" : "dev-lambda-seoul-rpc-",
        "functions" : [
            {
                "FunctionName" : "helloWorld",
                "Type" : "invoke",
                "Description" : "RPC 테스트", 
                "Handler" : "index.handler", 
                "Environment" : {
                    "Variables" : {
                        "NODE_ENV" : "development"
                    }
                },
                "MemorySize" : 128,
                "Role" : "arn:aws:iam::123456789123:role/aws-lambda-rpc-role",
                "Runtime" : "nodejs6.10", 
                "Timeout" : 10, 
                "VpcConfig" : {
                    "SecurityGroupIds" : [ "sg-12345678" ],
                    "SubnetIds" : [ "subnet-12345678", "subnet-98765432"]
                }
            }
        ]
    },
    "production" : {
        "region" : "ap-northeast-2",
        "prefix" : "prd-lambda-seoul-rpc-",
        "functions" : []
    }
}
```
