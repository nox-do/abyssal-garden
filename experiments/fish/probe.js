// QA only: evaluate the actual vertex math on the GPU, including its float hash.
globalThis.__visual.fishProbe = async function(times=[8]) {
  const data = new Float32Array(globalThis.__fishData.slice(4240*8));
  if (!data.length) return {frames:[]};
  const n=data.length/8, size=n*32;
  const input=buf(data,BU.STORAGE), output=device.createBuffer({size,usage:BU.STORAGE|BU.COPY_SRC}), read=device.createBuffer({size,usage:BU.COPY_DST|BU.MAP_READ});
  const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:SS.COMPUTE,buffer:{type:'read-only-storage'}},{binding:1,visibility:SS.COMPUTE,buffer:{type:'storage'}}]});
  const code=W_ANIM.replace('@vertex fn vsFish','fn evalFish')+`
    @group(1) @binding(0) var<storage,read> inputs:array<vec4f>;
    @group(1) @binding(1) var<storage,read_write> outputs:array<vec4f>;
    @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3u){
      if(id.x*2u>=arrayLength(&inputs)){return;}
      var i:VI;i.a=inputs[id.x*2u];i.b=inputs[id.x*2u+1u];i.n=vec4f(0.,0.,1.,0.);
      let o=evalFish(i);outputs[id.x*2u]=vec4f(o.wp,o.sd);outputs[id.x*2u+1u]=vec4f(o.n,0.);
    }`;
  const shared=device.createBindGroupLayout({entries:[{binding:0,visibility:SS.COMPUTE,buffer:{}},{binding:3,visibility:SS.COMPUTE,sampler:{type:'comparison'}},{binding:4,visibility:SS.COMPUTE,texture:{sampleType:'depth'}}]});
  const globals=device.createBindGroup({layout:shared,entries:[{binding:0,resource:{buffer:ubo}},{binding:3,resource:sCmp},{binding:4,resource:tShadow.createView()}]});
  const pipeline=device.createComputePipeline({layout:device.createPipelineLayout({bindGroupLayouts:[shared,layout]}),compute:{module:mod(code),entryPoint:'probe'}});
  const group=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]});
  const frames=[];let minClearance=1,maxY=-Infinity;
  for(const time of times){
    UB[35]=time;Q.writeBuffer(ubo,0,UB);
    const e=device.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(pipeline);p.setBindGroup(0,globals);p.setBindGroup(1,group);p.dispatchWorkgroups(Math.ceil(n/64));p.end();e.copyBufferToBuffer(output,0,read,0,size);Q.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);
    const values=Array.from(new Float32Array(read.getMappedRange()));read.unmap();
    for(let j=0;j<values.length;j+=8){const [x,y,z]=values.slice(j,j+3);maxY=max(maxY,y+.4);for(const [dx,dy,dz] of [[0,0,0],[.4,0,0],[-.4,0,0],[0,.4,0],[0,-.4,0],[0,0,.4],[0,0,-.4]])minClearance=min(minClearance,-rockAt(x+dx,y+dy,z+dz));}
    if(times.length<4)frames.push({time,values});
  }
  input.destroy();output.destroy();read.destroy();return {frames,count:n,times:times.length,minClearance,maxY};
};
