'use strict'

const aws = require('aws-sdk');
const gulp = require('gulp');
const path = require('path');
const through = require('through2');

/************************
 * RPC 생성 클래스
 ************************/
class RPC {
    constructor(args) {
        if (args === undefined)  args = './config/deploy.json';

        if (path.isAbsolute(args) ) {
            this.config = require(args)[process.env.NODE_ENV];
        } else {
            this.config = require(process.env.PWD + "/" + args)[process.env.NODE_ENV];
        } // if

        this.init();
    } // constructor()

    /*******************************************************
     * 초기화.
     * 설정을 참조해 Lambda 함수를 읽어, 호출을 위한 정보를 생성한다.
     *******************************************************/
    init() {
        console.log("### RPC.parse()");
        var self = this;
        // Lambda 객체 생성
        self._lambda = new aws.Lambda({
            apiVersion: '2015-03-31',
            region : this.config.region
        });
    } // parse()

    /***************************
     * Lambda 함수를 호출한다.
     ***************************/
    _invoke(obj, function_name, receiver) {
        console.log("### INVOKE :", function_name);

        // Find Function
        let func_name = null;
        this.config.functions.forEach((fn)=>{
            if (function_name === fn.FunctionName) {
                console.log("## Matched");
                func_name = this.config.prefix + fn.FunctionName;
            } // if
        });
        if (func_name === null) {
            console.log("### Function Not Found");
            return Reflect.get(obj, function_name, receiver);
        } // if

        var self = this;
        var dummy = (function(...args){
            return new Promise((resolve, reject) => {
                let params = {
                    FunctionName : func_name,
                    InvocationType : "RequestResponse",
                    LogType : "Tail",
                    Payload : JSON.stringify(args)
                };

                self._lambda.invoke(params, (err, data) => {
                    if (err) {
                        console.error("### ERR :", err);
                        reject(err);
                        return;
                    } // if

                    if (data.StatusCode !== 200) {
                        console.log("### Status Code NOT Matched");
                        reject(data);
                        return;
                    } // if
                    
                    // Success
                    data.Log = new Buffer(data.LogResult, 'base64').toString();
                    // console.log("## Log ################################");
                    // console.log(data.Log);
                    // console.log("#######################################");

                    let result = JSON.parse(data.Payload);
                    if (result.errorMessage !== undefined && result.errorMessage !== null) {
                        console.log("### LAMBDA RPC ERROR");
                        reject(data);
                    } else {
                        console.log("### LAMBDA RPC SUCCESS");
                        resolve(data);
                    } // if
                }); // lambda.invoke()

                
            }).catch((err)=>{
                throw(err);
            });
        }); // dummy
        return dummy;
    } // _invoke()

    /*************************
     * Lambda 배포
     *************************/
    deploy(target) {
        let config = this.config;
        let lambda = new aws.Lambda({
            apiVersion: '2015-03-31',
            region : config.region
        });
        return (through.obj((funcs, enc, next) => {
            console.log("### Deploy Lambda Function :", target);
            // next(null, funcs);

            // 설정파일 읽기
            let func_config = null;
            config.functions.forEach((func)=>{
                if (func.FunctionName === target) {
                    // console.log("## Find It! :", func);
                    func_config = func;
                } // if
            });

            if (func_config == null) {
                console.log("### 'Target'을 찾을 수 없습니다. ", target);
                return;
            } // if

            // // Lambda 함수 존재여부를 확인한다.
            lambda.getFunction({
                FunctionName : config.prefix + func_config.FunctionName
            }, (err, data) => {
                if (err) {
                    console.log("### ERROR :", err.code);
                    if (err.code === 'ResourceNotFoundException') {
                        // 없는 Lambda 함수. 새로 생성한다.
                        console.log("### Lambda 함수가 없습니다. 새로 생성합니다.");
                        console.log("Lambda 함수 신규 생성 :", config.prefix + func_config.FunctionName);
                        let lambda_params = {
                            Code: {
                                ZipFile : funcs.contents
                            },
                            Description: func_config.Description, 
                            FunctionName: config.prefix + func_config.FunctionName, 
                            Handler: func_config.Handler,
                            Environment : func_config.Environment,
                            MemorySize: func_config.MemorySize, 
                            Publish: true, 
                            Role: func_config.Role,
                            Runtime: func_config.Runtime,
                            Timeout: func_config.Timeout, 
                            VpcConfig: func_config.VpcConfig
                        };

                        // console.log("### Lambda Parameter :", lambda_params);
                        lambda.createFunction(lambda_params, (err, data) => {
                            // console.log(data);
                            func_config.FunctionConfiguration = data;
                            next(err, funcs);
                        });
                    } else {
                        // 알 수 없는 오류.
                        return 'Unknown error';
                    } // if
                } else {
                    // 함수가 존재한다.
                    // console.log("### Function :", data);
                    console.log("### Lambda 함수 있음. 업데이트 수행");
                    console.log("업데이트를 수행할 Lambda 함수 :", config.prefix + func_config.FunctionName);
                    Promise.resolve()
                    .then(() => {
                        return new Promise((resolve, reject) => {
                            // Lambda 환경설정 업데이트
                            lambda.updateFunctionConfiguration({
                                Description: func_config.Description, 
                                FunctionName: config.prefix + func_config.FunctionName, 
                                Handler: func_config.Handler,
                                Environment : func_config.Environment,
                                MemorySize: func_config.MemorySize, 
                                Role: func_config.Role,
                                Runtime: func_config.Runtime,
                                Timeout: func_config.Timeout, 
                                VpcConfig: func_config.VpcConfig
                            }, (err, data)=>{
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            }); // lambda.updateFunctionConfiguration()
                        }).catch((err)=>{
                            throw(err);
                        });
                    })
                    .then(()=>{
                        return new Promise((resolve, reject) => {
                            // 코드 업데이트
                            lambda.updateFunctionCode({
                                FunctionName: config.prefix + func_config.FunctionName, 
                                Publish: true, 
                                ZipFile : funcs.contents
                            }, (err, data) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    // console.log(data);
                                    func_config.FunctionConfiguration = data;
                                    resolve();
                                } // if
                            }); // lambda.updateFunctionCode()
                        }).catch((err)=>{
                            throw(err);
                        });
                    })
                    .catch((err) => {
                        console.log("### Lambda 업데이트 오류 :", err);
                        return 'Lambda Update Error';
                    })
                    .then(()=>{
                        console.log("### Lambda 함수 생성 완료");
                        next(null, funcs);
                    });
                } // if check getFunction error
            }); // lambda.getFunction()

        })); // return deploy()
    } // deploy
}; // class RPC

module.exports = function(args) {
    let rpc = new RPC(args);
    let handler = {
        get : function(obj, key, receiver) {
            console.log("## CALL Proxy");
            console.log("### Key :", key);
            return rpc._invoke(obj, key, receiver);
        }, // get()};

    };
    let proxy = new Proxy(rpc, handler);
    return proxy;
} // module.exports
