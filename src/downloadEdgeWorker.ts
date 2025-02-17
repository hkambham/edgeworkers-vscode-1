/* eslint-disable @typescript-eslint/naming-convention */
'use strict';
import * as vscode from 'vscode';
import {textForCmd,ErrorMessageExt,textForInfoMsg } from './textForCLIAndError';
import * as edgeWorkerCommands from './edgeWorkerCommands';
import {getFilePathFromInput} from './extension';
import * as akamiCLICalls from './akamiCLICalls';
import * as os from 'os';
import * as path from 'path';

export const downloadEdgeWorker = async function(edgeworkerID: string, edgeworkerVersion:string):Promise<boolean>{
    try{
        let tarFilePath = os.tmpdir();
        const tarFileFSPath = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: 'Select folder to download EdgeWorker',
        });
        if(tarFileFSPath !== undefined && tarFileFSPath.length >0){
             tarFilePath= getFilePathFromInput(tarFileFSPath[0]);
        }
        const cmd = await akamiCLICalls.getEdgeWorkerDownloadCmd("edgeworkers","download",edgeworkerID,edgeworkerVersion,tarFilePath,path.resolve(os.tmpdir(),"akamaiCLIOput.json"));
        const status = await akamiCLICalls.executeAkamaiEdgeWorkerCLICmds(akamiCLICalls.generateCLICommand(cmd),path.resolve(os.tmpdir(),"akamaiCLIOput.json"),"msg");
        const tarFile = await status.substring(status.indexOf('@') + 1);
        const tarFileName = path.parse(tarFile).base;
        const edgeworkerBundle =  tarFileName.substr(0,tarFileName.lastIndexOf('.'));
        const bundlePath = path.resolve(tarFilePath,edgeworkerBundle);
        const statusUntar = await akamiCLICalls.executeCLICommandExceptTarCmd(`cd  ${tarFilePath} && mkdir ${edgeworkerBundle} && cd  ${bundlePath} && tar --extract --file ${tarFile}`);
        vscode.window.showInformationMessage(`${textForInfoMsg.tar_download_success} id: ${edgeworkerID} version: ${edgeworkerVersion} at: ${bundlePath}`);
        return(true);
    }catch(e:any){
        vscode.window.showErrorMessage(ErrorMessageExt.bundle_download_fail+' '+ `${edgeworkerID}`+' '+ `${edgeworkerVersion}`+" "+ErrorMessageExt.display_original_error+e.toString());
        return(false);
    }
};


