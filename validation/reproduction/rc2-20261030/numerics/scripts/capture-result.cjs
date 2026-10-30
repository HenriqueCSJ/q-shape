'use strict';
function normalize(points){const mean=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length),c=points.map(p=>p.map((v,k)=>v-mean[k])),r=Math.sqrt(c.reduce((s,p)=>s+p.reduce((t,v)=>t+v*v,0),0)/points.length);return c.map(p=>p.map(v=>v/r));}
function capture(result,donors,reference){
    const actual=normalize([...donors,[0,0,0]]),ref=normalize(reference),a=result.alignedCoords,N=actual.length,m=result.transformationMatrix.elements;
    const transformed=actual.map(p=>[0,1,2].map(k=>m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]));
    const matching=result.matching;
    const reconstructionDifference=Math.max(...matching.map(([i,j])=>Math.hypot(...transformed[i].map((v,k)=>v-a[j][k]))));
    const orthogonalityError=Math.max(...[0,1,2].flatMap(i=>[0,1,2].map(j=>Math.abs([0,1,2].reduce((s,k)=>s+m[i*4+k]*m[j*4+k],0)-(i===j?1:0)))));
    const dot=a.reduce((s,p,i)=>s+p.reduce((v,x,k)=>v+x*ref[i][k],0),0),den=ref.reduce((s,p)=>s+p.reduce((v,x)=>v+x*x,0),0),optimalScale=Math.max(0,dot/den);
    const directResidual=100*a.reduce((s,p,i)=>s+p.reduce((v,x,k)=>v+(x-optimalScale*ref[i][k])**2,0),0)/N;
    const diagnostics={comparisonConvention:result.comparisonConvention,alignmentParity:result.alignmentParity,selectedBranch:result.selectedBranch,
        branchScores:result.branchScores,branchFinalizations:result.branchFinalizations,matching,transformationMatrix:m,
        properRotationMatrix:result.properRotationMatrix.elements,alignedCoords:a,optimalScale,directResidual,
        residualDifference:Math.abs(directResidual-result.measure),determinant:result.transformationMatrix.determinant(),
        properDeterminant:result.properRotationMatrix.determinant(),reconstructionDifference,orthogonalityError};
    const failures=[];
    if(!Number.isFinite(result.measure)||result.measure<0||result.measure>100)failures.push('measure_domain');
    if(diagnostics.comparisonConvention!=='cshm-o3-v1'||![-1,1].includes(diagnostics.alignmentParity))failures.push('convention');
    if(Math.abs(diagnostics.determinant-diagnostics.alignmentParity)>1e-8||Math.abs(diagnostics.properDeterminant-1)>1e-8||orthogonalityError>1e-8)failures.push('matrix');
    if(reconstructionDifference>1e-9||diagnostics.residualDifference>1e-9)failures.push('residual');
    if(matching.length!==N||new Set(matching.map(([i])=>i)).size!==N||new Set(matching.map(([,j])=>j)).size!==N||!matching.some(([i,j])=>i===N-1&&j===N-1))failures.push('matching');
    if(result.measure!==Math.min(result.branchScores.proper,result.branchScores.reflected)||result.measure>result.branchScores.proper+1e-12)failures.push('branch_selection');
    return {diagnostics,failures};
}
module.exports={capture};
