import React, { useRef, useState } from 'react';
import { Files, Scissors, FileImage, FileText, Download, UploadCloud, ShieldCheck, Menu, X, Sparkles, Settings, CheckCircle2, RefreshCw, ScanText, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { createWorker } from 'tesseract.js';

const tools = [
 {id:'merge',name:'Merge PDF',desc:'Combine several PDF files into one document.',icon:Files,tag:'POPULAR'},
 {id:'split',name:'Split PDF',desc:'Extract a page or a page range from a PDF.',icon:Scissors,tag:'PDF TOOL'},
 {id:'image',name:'Image converter',desc:'Convert common images into PNG or JPEG.',icon:FileImage,tag:'IMAGE TOOL'},
 {id:'ocr',name:'Image to text (OCR)',desc:'Recognize text in a photo or scanned image.',icon:ScanText,tag:'SMART TOOL'},
 {id:'info',name:'PDF information',desc:'Check page count and document details.',icon:FileText,tag:'PDF TOOL'}
];
function AdminLogin(){return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'#0c1422',color:'#eef'}}><section style={{width:'min(100%,420px)',padding:28,background:'#111d2e',border:'1px solid #30415c',borderRadius:16}}><a href='/' style={{color:'#a9a0ff'}}>← Back to tools</a><h1>Admin login</h1><p>Admin access is being connected securely. Please do not enter a real password yet.</p><label>Email<input type='email' placeholder='Admin email' style={{display:'block',width:'100%',padding:12,margin:'8px 0 18px'}} /></label><label>Password<input type='password' placeholder='Password' style={{display:'block',width:'100%',padding:12,margin:'8px 0 18px'}} /></label><button type='button' onClick={()=>alert('Secure admin authentication is not active yet.')} style={{width:'100%',padding:12,background:'#8178ef',color:'white',border:0,borderRadius:8}}>Sign in</button></section></main>;}
export default function App(){
 if(window.location.pathname==='/admin') return <AdminLogin/>;
 const [active,setActive]=useState('merge'),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[mobile,setMobile]=useState(false),[pageRange,setPageRange]=useState('1'),[ocrText,setOcrText]=useState('');
 const picker=useRef(null);
 const current=tools.find(t=>t.id===active)||tools[0];
 const choose=e=>{setFiles(Array.from(e.target.files||[]));setNotice('');setOcrText('');};
 const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const reset=()=>{setFiles([]);setNotice('');setOcrText('');if(picker.current)picker.current.value='';};
 const process=async()=>{
  if(!files.length){setNotice('আগে আপনার ডিভাইস থেকে ফাইল নির্বাচন করুন।');return;}
  setBusy(true);setNotice('');setOcrText('');
  try{
   if(active==='merge'){
    if(files.length<2)throw new Error('Merge করতে কমপক্ষে ২টি PDF নির্বাচন করুন।');
    const out=await PDFDocument.create();
    for(const f of files){const doc=await PDFDocument.load(await f.arrayBuffer());const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(p=>out.addPage(p));}
    download(new Blob([await out.save()],{type:'application/pdf'}),'merged-document.pdf');setNotice('PDF সফলভাবে একত্র করা হয়েছে।');
   }else if(active==='split'){
    const doc=await PDFDocument.load(await files[0].arrayBuffer());const total=doc.getPageCount();
    const selected=new Set();
    for(const part of pageRange.split(',')){const [a,b]=part.trim().split('-').map(Number);if(!Number.isInteger(a)||a<1||a>total)throw new Error('Page range ঠিক নয়। মোট পৃষ্ঠা: '+total);const end=b===undefined?a:b;if(!Number.isInteger(end)||end<a||end>total)throw new Error('Page range ঠিক নয়। মোট পৃষ্ঠা: '+total);for(let p=a;p<=end;p++)selected.add(p-1);}
    if(!selected.size)throw new Error('যে পৃষ্ঠা বের করতে চান তা লিখুন, যেমন 1-3,5।');
    const zip=new JSZip();let index=1;
    for(const page of [...selected].sort((a,b)=>a-b)){const out=await PDFDocument.create();const [copy]=await out.copyPages(doc,[page]);out.addPage(copy);zip.file('page-'+(page+1)+'.pdf',await out.save());index++;}
    download(await zip.generateAsync({type:'blob'}),'split-pages.zip');setNotice('নির্বাচিত '+selected.size+'টি পৃষ্ঠা ZIP ফাইলে ডাউনলোড হয়েছে।');
   }else if(active==='image'){
    const f=files[0],img=new Image(),url=URL.createObjectURL(f);
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('এই image খোলা যাচ্ছে না।'));img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image convert করা যায়নি।');
    download(blob,(f.name.replace(/\.[^.]+$/,'')||'image')+'.png');URL.revokeObjectURL(url);setNotice('PNG image তৈরি হয়েছে।');
   }else if(active==='ocr'){
    const worker=await createWorker('eng');try{const result=await worker.recognize(files[0]);setOcrText(result.data.text||'কোনো লেখা পাওয়া যায়নি।');setNotice('ছবির লেখা শনাক্ত করা হয়েছে।')}finally{await worker.terminate();}
   }else{
    const doc=await PDFDocument.load(await files[0].arrayBuffer());setNotice('PDF ঠিকভাবে খোলা হয়েছে। মোট পৃষ্ঠা: '+doc.getPageCount());
   }
  }catch(e){setNotice(e.message||'ফাইলটি প্রসেস করা যায়নি। অন্য ফাইল দিয়ে চেষ্টা করুন।');}
  finally{setBusy(false);}
 };
 const accept=active==='image'||active==='ocr'?'image/*':'.pdf,application/pdf';
 return <div className="app">
  <aside className={mobile?'sidebar open':'sidebar'}>
   <div className="brand"><div className="brand-mark"><Sparkles size={21}/></div><div><b>AI SMART</b><small>ALL INFO EDITOR</small></div><button className="close mobile-only" onClick={()=>setMobile(false)}><X/></button></div>
   <div className="nav-label">WORKSPACE</div><button className="nav active"><Files size={18}/> PDF & Image tools</button><button className="nav" onClick={()=>setNotice('Account login and cloud file storage will be added in the next backend stage.')}><ShieldCheck size={18}/> My account</button><button className="nav" onClick={()=>setNotice('Admin dashboard will be added in the next backend stage.')}><Settings size={18}/> Admin panel</button>
   <div className="side-bottom"><div className="secure"><ShieldCheck size={18}/><span><b>Private processing</b><small>In this version, files are processed locally in your browser.</small></span></div><small className="version">VERSION 1.1 · BETA</small></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main"><header><button className="menu mobile-only" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> PDF & Image tools</div><div className="header-right"><a className="admin-link" href="/admin">Admin Login</a><span className="status-dot"/> Tools ready <div className="avatar">AI</div></div></header>
   <section className="hero"><div className="eyebrow"><Sparkles size={14}/> YOUR ALL-IN-ONE DOCUMENT WORKSPACE</div><h1>Make files work <em>smarter.</em></h1><p>Merge PDFs, extract pages, convert images and recognize text in one simple workspace.</p></section>
   <section className="tool-grid">{tools.map(t=><button key={t.id} className={'tool-card '+(active===t.id?'selected':'')} onClick={()=>{setActive(t.id);reset();}}><div className="tool-top"><span className="tool-icon"><t.icon size={21}/></span><span className="tag">{t.tag}</span></div><b>{t.name}</b><p>{t.desc}</p></button>)}</section>
   <section className="workspace"><div className="work-title"><div><span className="eyebrow">SELECTED TOOL</span><h2>{current.name}</h2><p>{current.desc}</p></div><span className="ready"><CheckCircle2 size={15}/> Ready</span></div>
    <div className="dropzone" onClick={()=>picker.current?.click()}><input ref={picker} type="file" accept={accept} multiple={active==='merge'} onChange={choose} hidden/><div className="upload-icon"><UploadCloud size={26}/></div><b>Choose {active==='merge'?'PDF files':active==='image'||active==='ocr'?'an image':'a PDF file'}</b><p>Tap to browse files on your device</p><span className="file-limit">{active==='merge'?'Select two or more PDF files':active==='image'||active==='ocr'?'JPG, PNG and other browser-supported images':'PDF documents supported'}</span></div>
    {files.length>0&&<div className="file-list">{files.map((f,i)=><div className="file-row" key={i}><FileText size={18}/><span>{f.name}</span><small>{(f.size/1024/1024).toFixed(2)} MB</small><button className="remove" onClick={()=>setFiles(old=>old.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>)}</div>}
    {active==='split'&&<label className="range-field">Pages to extract <input value={pageRange} onChange={e=>setPageRange(e.target.value)} placeholder="Example: 1-3,5,8-10"/><small>কমা দিয়ে আলাদা পৃষ্ঠা, অথবা 1-3 এর মতো range লিখুন।</small></label>}
    <div className="actions"><button className="primary" onClick={process} disabled={busy}>{busy?<RefreshCw className="spin" size={17}/>:<Download size={17}/>} {busy?'Processing…':active==='info'?'Read PDF details':active==='ocr'?'Recognize text':'Process & download'}</button><button className="secondary" onClick={reset}>Clear</button></div>
    {notice&&<div className="notice">{notice}</div>}
    {ocrText&&<div className="ocr-result"><div className="result-head"><b>Recognized text</b><button className="secondary" onClick={()=>navigator.clipboard?.writeText(ocrText)}>Copy text</button></div><textarea value={ocrText} onChange={e=>setOcrText(e.target.value)} rows={8}/></div>}
   </section>
   <footer><span>© 2026 AI Smart All Info</span><span>Simple document tools for everyone</span></footer>
  </main>
 </div>;
}
