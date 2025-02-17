/* eslint-disable @typescript-eslint/naming-convention */
import { promise } from 'selenium-webdriver';
import * as vscode from 'vscode';
import * as edgeWorkerCommands from './edgeWorkerCommands';
import * as akamaiCLIConfig from './cliConfigChange';
import {textForCmd,ErrorMessageExt,textForInfoMsg,systemType } from './textForCLIAndError';
const exec = require('child_process').exec;
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
const ostype = os.type();

export const isAkamaiCLIInstalled = async function():Promise<boolean>{
    try{
        const cmd:string[]= [`${textForCmd.akamai_version}`];
        await akamaiCLIConfig.setAkamaiCLIConfig();
        const process = await executeCLICommandExceptTarCmd(generateCLICommand(cmd));
        return true;
    } catch(e){
        return false;
    }
};
export const checkEnvBeforeEachCommand = async function():Promise<string>{
        if (!await isAkamaiCLIInstalled()) {
            const resp = await vscode.window.showErrorMessage(ErrorMessageExt.akamai_cli_not_installed, 'Install');
            if (resp === 'Install') {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(ErrorMessageExt.akamai_download_URI));
            }
            throw new Error(`Install Akamai CLI using the refernce:${ErrorMessageExt.akamai_download_URI}`);
        }
        else{
            if (!await checkAndInstallAkamaiCommands(textForCmd.akamai_help,"edgeworkers")) {
                const resp = await vscode.window.showErrorMessage(ErrorMessageExt.edgeWorkers_cli_to_install, 'Install');
                if (resp === 'Install') {
                if(!await checkAndInstallAkamaiCommands(textForCmd.install_akamai_edgeworkers,"install")){
                    throw new Error(`Akamai Edgeworkers install faled! .Install Akamai Edgeworkers using the refernce:${ErrorMessageExt.edgeworker_download_URI}`);
                }
                }
                else{
                    throw new Error(`Install Akamai Edgeworkers using the refernce:${ErrorMessageExt.edgeworker_download_URI}`);
                }
            } 
        }
        return('done');
};
export const executeCLICommandExceptTarCmd = function(cmd : string, jsonFile?:string) : Promise<string> {
    // wrap exec in a promise
    return new Promise(async (resolve, reject) => {
        await exec(cmd, (error : Error, stdout : string, stderr : string) => {
            if (error) {
                if (stderr) {
                    reject(stderr);
                } else {
                    reject('failure');
                }
            } else {
                if (stdout){
                    resolve(stdout);
                } else {
                    resolve('done');
                }
            }
        });
    });
};

export const akamaiHelpCmd = function(cmd:string) : Promise<string> {
    // wrap exec in a promise
    return new Promise(async (resolve, reject) => {
        await exec(cmd, (error : Error, stdout : string, stderr : string) => {
            if(stdout){
                resolve(stdout);
            }
            else{
                reject();
            }
        });
    });
};

export const executeCLIOnlyForTarCmd = async function(bundleFolder:string, bundlepath:string,tarFileName:string) : Promise<string> {
  const cmd = await generateCLICommand(await getTarCmd(bundleFolder,bundlepath,tarFileName));
    // on command error an exception will be thrown to bubble outwrad
    await new Promise((resolve, reject) => {
        exec(cmd,{}, (error:Error,stdout:string, stderr:string)=>{
            if (error) {
                const status = stderr.toString();
                reject(`${ErrorMessageExt.create_bundle_fail} ${tarFileName}.tgz ${ErrorMessageExt.display_original_error} ${status}`);
            } else {
                resolve(true);
            }
        });
    });
    // if the process above is done, we should assume the file is created
    return `Successfully created the EdgeWorker bundle - ${tarFileName}.tgz`;
};
export const  getTarCmd = async function(bundleFolder:string,bundlepath:string,tarFileName:string):Promise<Array<string>>{
        return(  ["cd",`${bundleFolder}`, "&&","tar","--disable-copyfile","-czvf",bundlepath, '--exclude="*.tgz"', "*"]);
};

export const deleteOutput = async function(filePath:string):Promise<string>{
    let deleteFile:string = '';
    if(ostype === systemType.windows){
        deleteFile =  `del ${filePath}`;
    }
    else{
        deleteFile =  `rm  ${filePath}`;
    }
    await new Promise((resolve, reject) => {
       exec(deleteFile,{}, (error:Error,stdout:string, stderr:string)=>{
        if (error) {
            const status = stderr.toString();
            reject('');
        } else {
            if(fs.existsSync(filePath)){throw new Error(ErrorMessageExt.file_replace_error + path.basename(filePath));}
            resolve('');
        }
    }); 
    });
    return('');
};

export const untarTarballToTempDir = async function (tarFilePath:string, edgeworkerBundle:string):Promise<string>{
    try{
        const tarFileDir = os.tmpdir();
        const tempfol = path.resolve(tarFileDir,edgeworkerBundle);
        const tempFolder = `${tempfol}-${Date.now()}`;
        const statusUntar = await executeCLICommandExceptTarCmd(`mkdir ${tempFolder} && tar -xf ${tarFilePath} -C  ${tempFolder}`);
        return tempFolder;
    }catch(e){
        throw new Error("failed to untar the file: "+`${edgeworkerBundle}`+ErrorMessageExt.display_original_error+e);
    }
};
export const deleteOutputFolder = function(path:string){
    let deleteFolder:string = '';
    if(ostype === systemType.windows){
        deleteFolder = `rmdir /Q /S ${path}`;
    }
    else{
        deleteFolder = `rm -rf ${path}`;
    }
    exec(deleteFolder);
};

export const updateEdgeWorkerToSandboxCmd = function(type:string,command:string,bundlePath:string,edgeWorkerID:string):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,edgeWorkerID,bundlePath);
    return (cmd);
};
export const getEdgeWorkerActivationCmd = function(type:string,command:string,edgeworkerID:string,network:string,edgeworkerVersion:string,jsonFilePath:string,):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,edgeworkerID,network,edgeworkerVersion);
    return (jsonOutputParams(cmd,jsonFilePath));
};
export const getEdgeWorkerRegisterCmd = function(type:string,command:string,resourceId:string,groupId:string,ewName:string,jsonFilePath:string,):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,"--resourceTierId",resourceId,groupId,ewName);
    return (jsonOutputParams(cmd,jsonFilePath));
};
export const getEdgeWorkerDownloadCmd = function(type:string,command:string,edgeworkerID:string,edgeworkerVersion:string,tarFilePath:string, jsonFilePath:string):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,edgeworkerID,edgeworkerVersion,"--downloadPath",tarFilePath);
    return (jsonOutputParams(cmd,jsonFilePath));
};
export const getEdgeWorkerValidateCmd = function(type:string,command:string,tarFilePath:string,jsonFilePath:string):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,tarFilePath);
    return (jsonOutputParams(cmd,jsonFilePath));
};
export const getEdgeWorkerListVersions = function(type:string,command:string,edgeworkerID:string,jsonFilePath:string,akamaiConfigcmd:string[]):string[]{
    let cmd = akamiTypeCmd(type);
    akamaiConfigcmd.forEach(async (element: any) => {
    cmd.push(element);
    });
    cmd.push(command,edgeworkerID);
    cmd= jsonOutputParams(cmd,jsonFilePath);
    return (cmd);
};
export const getEdgeWorkerListIds = function(type:string,command:string,jsonFilePath:string,akamaiConfigcmd:string[]):string[]{
    let cmd = akamiTypeCmd(type);
    akamaiConfigcmd.forEach(async (element: any) => {
    cmd.push(element);
    });
    cmd.push(command);
    return (jsonOutputParams(cmd,jsonFilePath));
};

export const getUploadEdgeWorkerCmd = function(type:string,command:string,bundlePath:string,edgeWorkerID:string,jsonFilePath:string):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,"--bundle",bundlePath,edgeWorkerID);
    return (jsonOutputParams(cmd,jsonFilePath));
};

export const getAkamaiEWTraceCmd = function(type:string,command:string,hostname:string,jsonFilePath:string):string[]{
    let cmd = akamaiEdgeWorkerOptionsCmd(type);
    cmd.push(command,hostname);
    return (jsonOutputParams(cmd,jsonFilePath));
};

export const akamiTypeCmd =function(type:string):string[]{
    if(type==="sandbox"){
        return(["akamai","sandbox"]);
    }
    else if(type==="edgeworkers"){
        return(["akamai","edgeworkers"]);
    }
    else{
        return(["akamai"]);
    }
};
export const akamaiEdgeWorkerOptionsCmd = function(type:string):string[]{
    let cmd = akamiTypeCmd(type);
    let accountkey = edgeWorkerCommands.getAccountKeyFromUserConfig();
    let section = edgeWorkerCommands.getSectionNameFromUserConfig();
    let edgerc = edgeWorkerCommands.getEdgercFilePathFromUserConfig();
    if(edgerc !== null && edgerc !== '' && edgerc !== undefined){
        if(fs.existsSync(edgerc) === false){
            throw new Error(`Invalid .edgerc file path in user settings - ${edgerc}`);
        }
        else{
            cmd.push("--edgerc",`${edgerc}`);
        }
    }
    if(section !== null && section !== '' && section!== undefined){
        section= section.trim();
        cmd.push("--section",`${section}`);
    }
    if(accountkey !== null && accountkey !== ''&& accountkey !== undefined){
        accountkey= accountkey.trim();
        cmd.push("--accountkey",`${accountkey}`);
    }
    return cmd;
};

export const jsonOutputParams = function(cmd:string[],jsonFilePath:string):string[]{
    cmd.push("--json",jsonFilePath);
    return cmd;
};
export const generateCLICommand = function(cmdArgs: string[]):string{
    let command:string = '';
    if (typeof cmdArgs !== 'undefined' && cmdArgs.length > 0) {
        command = cmdArgs.join(" ").toString();
        console.log("command:" + command);
    }
    return command;
};
export const checkAkamaiSandbox = async function():Promise<string>{
    if(!isAkamaiCLIInstalled()){
        const resp = await vscode.window.showErrorMessage(
            ErrorMessageExt.akamai_sandbox_not_installed,
            'Install'
            );
        if (resp === 'Install') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(ErrorMessageExt.akamai_sanbox_download));
        }
        throw new Error(`Install Akamai CLI using the refernce:${ErrorMessageExt.akamai_download_URI}`);
        }
    else{
        if (!await checkAndInstallAkamaiCommands(textForCmd.akamai_help,"sandbox")) {
            const resp = await vscode.window.showErrorMessage(ErrorMessageExt.edgeWorkers_cli_to_install, 'Install');
            if (resp === 'Install') {
            if(!await checkAndInstallAkamaiCommands(textForCmd.install_akamai_sandbox,"install")){
                throw new Error(`Akamai Sandbox install faled! .Install Akamai Sandbox using the refernce:${ErrorMessageExt.akamai_sanbox_download}`);
            }
            }
            else{
                throw new Error(`Install Akamai Sandbox using the refernce:${ErrorMessageExt.akamai_sanbox_download} `);
            }
        } 
    }
    return('done');
};

export const checkAndInstallAkamaiCommands = async function(cmd:string,type:string):Promise<boolean>{
    try{
        if(type === "install"){
            await executeCLICommandExceptTarCmd(cmd);
        }
        else{
            const process = await akamaiHelpCmd(cmd);
            if(!process.toString().includes(type)){
                return false;
            }
        }
        return true;
    } catch(e){
        return false;
    }
};
export const parseJsonToGetResultAkamaiCLI = async function(filePathForJson:string,msg:string):Promise<string>{
    const result = await JSON.parse(fs.readFileSync(filePathForJson,'utf8'));
        if(result !== undefined || result.length !== 0){
                if(result.cliStatus.toString() === '0' && msg==="msg"){
                    return(result[msg]);
                }
                else if(result.cliStatus.toString() === '0' && msg==="data"){
                    return(JSON.stringify(result.data));
                }
                else
                {
                    if(result.data[0]["detail"] === undefined || result.data[0]["detail"] === null ){
                        throw new Error(`${result.msg}`);
                    }
                    else{
                        throw new Error(`${result.msg}`+ " due to "+ `${result.data[0]["detail"]}`);
                    }
                }
        }
        throw new Error("Error: Failed to execute The command");
};
export const executeAkamaiEdgeWorkerCLICmds = async function(cmd : string, jsonFilePath:string,msg:string) : Promise<string> {
    // wrap exec in a promise
    return new Promise(async (resolve, reject) => {
        await exec(cmd, async (error : Error, stdout : string, stderr : string) => {
            if(stdout) {
                try{
                    const output = await parseJsonToGetResultAkamaiCLI(jsonFilePath,msg);
                    resolve(output); 
                }catch(e){
                    reject(e);
                }
            }
            else if (error) {
                if (stderr) {
                    reject(stderr);
                } else {
                    reject('failure');
                }
            } 
        });
    });
};


