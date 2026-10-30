'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),repo=process.env.QSHAPE_SOURCE?path.resolve(process.env.QSHAPE_SOURCE):path.resolve(root,'../software');
const filename=path.join(repo,'src/constants/referenceGeometries/index.js');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(filename,'utf8').replace('export { normalize, REFERENCE_GEOMETRIES, POINT_GROUPS };','this.refs = REFERENCE_GEOMETRIES; this.groups=POINT_GROUPS;'),context,{filename});
fs.writeFileSync(path.join(root,'inputs/current-library.json'),JSON.stringify({sourceFile:filename,references:context.refs,pointGroups:context.groups},null,2)+'\n');
console.log(Object.values(context.refs).reduce((s,x)=>s+Object.keys(x).length,0),'references exported');
