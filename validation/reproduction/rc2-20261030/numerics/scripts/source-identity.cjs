'use strict';
const cp=require('child_process');
function sourceIdentity(repo,{expected=null,requireClean=false}={}){
    const declared=process.env.QSHAPE_ARCHIVE_REVISION;
    if(declared){
        if(!/^[0-9a-f]{40}$/.test(declared)||expected&&expected!==declared)throw Error('Invalid/mismatched declared archive revision');
        return {sourceCommit:declared,sourceBranch:null,sourceIdentityKind:'declared-archive-revision',observedGitCommit:null,cleanGitTree:null,
            identityLimitation:'Revision supplied explicitly for an extracted source archive; no Git revision or clean-tree state is claimed as observed.'};
    }
    const git=(...args)=>cp.execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
    const commit=git('rev-parse','HEAD'),status=git('status','--porcelain');
    if(expected&&commit!==expected||requireClean&&status)throw Error('Exact Git revision/clean-tree guard failed');
    if(git('diff','--name-only','HEAD','--','src/services/shapeAnalysis','src/services/algorithms','src/constants'))throw Error('Numerical source has uncommitted changes');
    return {sourceCommit:commit,sourceBranch:git('branch','--show-current'),sourceIdentityKind:'observed-git-revision',observedGitCommit:commit,cleanGitTree:status===''};
}
module.exports={sourceIdentity};
