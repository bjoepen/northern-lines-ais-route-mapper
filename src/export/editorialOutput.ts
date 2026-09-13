export type EditorialPaperSize='A5'|'A4'|'A3'|'A2';
export type EditorialOutputOrientation='auto'|'portrait'|'landscape';

const mm:Record<EditorialPaperSize,{w:number;h:number}>={A5:{w:148,h:210},A4:{w:210,h:297},A3:{w:297,h:420},A2:{w:420,h:594}};
const px300:Record<EditorialPaperSize,{w:number;h:number}>={A5:{w:1748,h:2480},A4:{w:2480,h:3508},A3:{w:3508,h:4961},A2:{w:4961,h:7016}};

function outputSvg():SVGSVGElement{
 const svg=document.querySelector('svg[viewBox]') as SVGSVGElement|null;
 if(!svg)throw new Error('Editoriale SVG-Szene nicht gefunden.');
 return svg;
}
function isLandscape(svg:SVGSVGElement){const v=(svg.getAttribute('viewBox')||'0 0 1 1').split(/\s+/).map(Number);return v[2]>v[3]}
function cloneForOutput(size:EditorialPaperSize){const source=outputSvg(),clone=source.cloneNode(true) as SVGSVGElement;const paper=mm[size],landscape=isLandscape(source);clone.removeAttribute('class');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',`${landscape?paper.h:paper.w}mm`);clone.setAttribute('height',`${landscape?paper.w:paper.h}mm`);return{source,clone,landscape}}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
export function exportEditorialSvg(size:EditorialPaperSize,fileStem:string){const{clone}=cloneForOutput(size);const xml=new XMLSerializer().serializeToString(clone);download(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),`${fileStem}-${size.toLowerCase()}.svg`)}
export async function exportEditorialPng(size:EditorialPaperSize,fileStem:string){const{clone,landscape}=cloneForOutput(size),xml=new XMLSerializer().serializeToString(clone),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('SVG konnte nicht gerastert werden.'));image.src=url});const dims=px300[size],canvas=document.createElement('canvas');canvas.width=landscape?dims.h:dims.w;canvas.height=landscape?dims.w:dims.h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas nicht verfügbar.');ctx.fillStyle='#f7f4ec';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG konnte nicht erzeugt werden.');download(blob,`${fileStem}-${size.toLowerCase()}-300dpi.png`)}finally{URL.revokeObjectURL(url)}}
