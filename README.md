# aws-lambda-rpc
Call aws lambda function like RPC

# Usage

## Step 1. Create lambda function

### ./lambda_function/helloWorld/index.js
```js
'use strict'

exports.handler = (event, context, callback) => {
    console.log("Receive event :", event);
    callback(null, `${event[0]} ${event[1]}`);
}; // handler()
```

## Step 2. Configuration

### ./config/deploy.json
```js
{
    "development" : {
        "region" : "ap-northeast-2",
        "prefix" : "dev-lambda-seoul-rpc-",
        "functions" : [
            {
                "FunctionName" : "helloWorld",
                "Type" : "invoke",
                "Description" : "helloWorld RPC", 
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

## Step 3. Deploy Lambda

### gulpfile.js
```js
const RPC = require('aws-lambda-rpc')('./config/deploy.json');

gulp.task('deploy', () => {
    gulp.src('./lambda_function/helloWorld/**/*')
    .pipe(zip(target + '.zip'))
    .pipe(RPC.deploy(target))    
});

```
```bash
    $ gulp deploy
```

## Step 4. Call Lambda
    
```js
'use strict'

const RPC = require('aws-lambda-rpc')('./config/deploy.json');

RPC.helloWorld('Hello,', 'World!').then((result)=>{
    console.log(result);
});

```

### Result
```
   "Hello, World!" 
```
