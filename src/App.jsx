import React, { useRef, useState } from 'react';
import { FileText, Image, Scissors, Files, Download, UploadCloud, ShieldCheck, Menu, X, Sparkles, Settings, Search, CheckCircle2, FileImage, RefreshCw } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

const tools = [
  { id:'merge', name:'Merge PDF', desc:'Combine multiple PDF files into one document.', icon:Files, tag:'POPULAR' },
  { id:'split', name:'Split PDF', desc:'Extract selected pages into a new PDF.', icon:Scissors, tag:'PDF TOOL' },
  { id:'image', name:'Image converter', desc:'Convert images to PNG, JPEG or WebP.', icon:FileImage, tag:'IMAGE TOOL' },
  { id:'compress', name:'PDF information', desc:'Inspect page count and document details.', icon:FileText, tag:'PDF TOOL' },
];
export default function App(){
 const [active,setActive]=useState('merge'), [files,setFiles]=useState([]), [busy,setBusy]=useState(false), [notice,setNotice]=useState(''), [mobile,setMobile]=useState(false);
 const picker=useRef(null);
 const choose=(e)=>{setFiles(Array.from(e.target.files||[]));setNotice('');};
 const download=(blob,name)=>{const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);};
 const run=async()=>{
  if(!files.length){setNotice('Please select one or more files first.');return;}
  setBusy(true);setNotice('');
  try{
   if(active==='merge'){
    if(files.length<2) throw new Error('Select at least two PDF files to merge.');
    const out=await PDFDocument.create();
    for(const f of files){const doc=await PDFDocument.load(await f.arrayBuffer());const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(p=>out.addPage(p));}
    download(new Blob([await out.save()],{type:'application/pdf'}),'merged-document.pdf');setNotice('Your merged PDF is ready.');
   }else if(active==='split'){
    const doc=await PDFDocument.load(await files[0].arrayBuffer());const out=await PDFDocument.create();const pages=await out.copyPages(doc,[0]);out.addPage(pages[0]);download(new Blob([await out.save()],{type:'application/pdf'}),'page-1.pdf');setNotice('Downloaded the first page. More page-range controls are coming.');
   }else if(active==='image'){
    const f=files[0];const img=new window.Image();const url=URL.createObjectURL(f);
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));download(blob,(f.name.replace(/\.[^.]+$/,'')||'image')+'.png');URL.revokeObjectURL(url);setNotice('PNG image downloaded.');
   }else{
    const doc=await PDFDocument.load(await files[0].arrayBuffer());setNotice('PDF loaded successfully — '+doc.getPageCount()+' page(s).');
   }
  }catch(e){setNotice(e.message||'Could not process this file. Please check the file format.');}
  finally{setBusy(false);}
 };
 const current=tools.find(t=>t.id===active)||tools[0];
 return <div className="app">
  <aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><div className="brand-mark"><Sparkles size={21}/></div><div><b>AI SMART</b><small>ALL INFO EDITOR</small></div><button className="close mobile-only" onClick={()=>setMobile(false)}><X/></button></div>
   <div className="nav-label">WORKSPACE</div><button className="nav active"><Files size={18}/> PDF & Image tools</button><button className="nav" onClick={()=>setNotice('Account and cloud storage will be enabled after backend setup.')}><ShieldCheck size={18}/> My account</button><button className="nav" onClick={()=>setNotice('Admin dashboard will be enabled after backend setup.')}><Settings size={18}/> Admin panel</button>
   <div className="side-bottom"><div className="secure"><ShieldCheck size={18}/><span><b>Private processing</b><small>Files are processed in your browser in this starter version.</small></span></div><small className="version">VERSION 1.0 · STARTER</small></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main"><header><button className="menu mobile-only" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> PDF & Image tools</div><div className="header-right"><span className="status-dot"/> All systems ready <div className="avatar">AI</div></div></header>
   <section className="hero"><div className="eyebrow"><Sparkles size={14}/> YOUR ALL-IN-ONE DOCUMENT WORKSPACE</div><h1>Make files work <em>smarter.</em></h1><p>Simple tools to merge PDFs, split pages and convert images — all in one place.</p></section>
   <section className="tool-grid">{tools.map(t=><button key={t.id} className={'tool-card '+(active===t.id?'selected':'')} onClick={()=>{setActive(t.id);setFiles([]);setNotice('');}}><div className="tool-top"><span className="tool-icon"><t.icon size={21}/></span><span className="tag">{t.tag}</span></div><b>{t.name}</b><p>{t.desc}</p></button>)}</section>
   <section className="workspace"><div className="work-title"><div><span className="eyebrow">SELECTED TOOL</span><h2>{current.name}</h2><p>{current.desc}</p></div><span className="ready"><CheckCircle2 size={15}/> Ready to use</span></div>
    <div className="dropzone" onClick={()=>picker.current?.click()}><input ref={picker} type="file" accept={active==='image'?'image/*':'.pdf,application/pdf'} multiple={active==='merge'} onChange={choose} hidden/><div className="upload-icon"><UploadCloud size={26}/></div><b>Choose {active==='merge'?'PDF files':active==='image'?'an image':'a PDF file'}</b><p>Tap to browse files on your device</p><span className="file-limit"> {active==='merge'?'Select 2 or more PDF files':'PDF or image files supported'} </span></div>
    {files.length>0&&<div className="file-list">{files.map((f,i)=><div className="file-row" key={i}><FileText size={18}/><span>{f.name}</span><small>{(f.size/1024/1024).toFixed(2)} MB</small></div>)}</div>}
    <div className="actions"><button className="primary" onClick={run} disabled={busy}>{busy?<RefreshCw className="spin" size={17}/>:<Download size={17}/>} {busy?'Processing…':active==='compress'?'Read PDF details':'Process & download'}</button><button className="secondary" onClick={()=>{setFiles([]);setNotice('');if(picker.current)picker.current.value='';}}>Clear</button></div>
    {notice&&<div className="notice">{notice}</div>}
   </section>
   <footer><span>© 2026 AI Smart All Info</span><span>Built for simple, secure document work</span></footer>
  </main>
 </div>;
}
