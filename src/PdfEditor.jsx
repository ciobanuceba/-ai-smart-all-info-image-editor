import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { UploadCloud, MousePointer2, Eraser, Type, ImagePlus, Copy, ClipboardPaste, Trash2, Undo2, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function PdfEditor() {
  const [file, setFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState('select');
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [textValue, setTextValue] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [textColor, setTextColor] = useState('#111111');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('edited.pdf');
  const [drag, setDrag] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [originalTextItems, setOriginalTextItems] = useState([]);
  const [originalSelected, setOriginalSelected] = useState(null);
  const [originalTextValue, setOriginalTextValue] = useState('');
  const [originalTextColor, setOriginalTextColor] = useState('#d11f35');
  const [originalCoverColor, setOriginalCoverColor] = useState('#ffffff');
  const [originalFontSize, setOriginalFontSize] = useState(12);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const pageSize = useRef({ width: 612, height: 792 });
  const pageItems = useMemo(() => items.filter(x => x.page === page), [items, page]);

  useEffect(() => {
    let live = true;
    async function render() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const pdfPage = await pdfDoc.getPage(page);
        const viewport = pdfPage.getViewport({ scale });
        pageSize.current = { width: viewport.width / scale, height: viewport.height / scale };
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        // Render above the display size so text stays sharp on high-DPI phones.
        const outputScale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        ctx.imageSmoothingEnabled = true;
        await pdfPage.render({
          canvasContext: ctx,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          intent: 'display'
        }).promise;
        const textContent = await pdfPage.getTextContent();
        const selectableText = textContent.items
          .filter(item => typeof item.str === 'string' && item.str.trim() && item.transform)
          .map((item, index) => {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const textHeight = Math.max(6, Math.hypot(tx[2], tx[3]));
            const left = tx[4];
            const top = tx[5] - textHeight;
            const textWidth = Math.max(5, item.width * scale);
            return {
              id: 'pdf-text-' + page + '-' + index,
              text: item.str,
              x: clamp(left / viewport.width, 0, 1),
              y: clamp(top / viewport.height, 0, 1),
              w: clamp(textWidth / viewport.width, 0.006, 1),
              h: clamp(textHeight / viewport.height, 0.008, 0.2)
            };
          });
        if (!live) return;
        setOriginalTextItems(selectableText);
      } catch (err) {
        if (live) setMessage('এই PDF পৃষ্ঠাটি দেখানো যায়নি। অন্য PDF দিয়ে চেষ্টা করুন।');
      }
    }
    render();
    return () => { live = false; };
  }, [pdfDoc, page, scale]);

  const remember = (next) => {
    setHistory(old => [...old.slice(-29), items]);
    setItems(next);
  };

  const loadFile = async (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setMessage('অনুগ্রহ করে একটি PDF ফাইল নির্বাচন করুন।');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const bytes = await f.arrayBuffer();
      // PDF.js may transfer/detach the buffer it receives. Keep a separate untouched copy for pdf-lib export.
      const exportBytes = bytes.slice(0);
      const previewBytes = bytes.slice(0);
      const loaded = await pdfjsLib.getDocument({ data: new Uint8Array(previewBytes) }).promise;
      setFile(f); setPdfBytes(exportBytes); setPdfDoc(loaded); setPageCount(loaded.numPages);
      setPage(1); setItems([]); setHistory([]); setSelected(null);
      setOriginalTextItems([]); setOriginalSelected(null); setOriginalTextValue('');
      setMessage('PDF খোলা হয়েছে। সম্পাদনা শুরু করতে টুল নির্বাচন করুন।');
    } catch (err) {
      setMessage('PDF খোলা যায়নি। ফাইলটি password-protected বা damaged হতে পারে।');
    } finally { setBusy(false); }
  };

  const pointFromEvent = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1)
    };
  };

  const [sampleColorMode, setSampleColorMode] = useState(false);
  const onPointerDown = (e) => {
    if (!pdfDoc || !wrapRef.current) return;
    const p = pointFromEvent(e);
    if (sampleColorMode && (selected || originalSelected)) {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        try {
          const pixel = ctx.getImageData(Math.min(canvas.width - 1, Math.max(0, Math.floor(p.x * canvas.width))), Math.min(canvas.height - 1, Math.max(0, Math.floor(p.y * canvas.height))), 1, 1).data;
          const hex = '#' + [...pixel].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
          if (originalSelected) {
            setOriginalTextColor(hex);
            setMessage('PDF থেকে Text Color নেওয়া হয়েছে: ' + hex);
          } else {
            setItems(old => old.map(it => it.id === selected && it.type === 'cover' ? { ...it, color: hex } : it));
            setMessage('PDF থেকে Cover Color নেওয়া হয়েছে: ' + hex);
          }
        } catch (err) { setMessage('এই জায়গার রং নেওয়া যায়নি। আবার চেষ্টা করুন।'); }
      }
      setSampleColorMode(false);
      return;
    }
    if (tool === 'cover') {
      e.preventDefault();
      wrapRef.current.setPointerCapture(e.pointerId);
      setDrag({ start: p, current: p, kind: 'cover' });
      return;
    }
    if (tool === 'text') {
      if (!textValue.trim()) { setMessage('আগে Text box-এ লেখা লিখুন।'); return; }
      const item = { id: uid(), page, type: 'text', x: p.x, y: p.y, w: 0.42, h: 0.07, text: textValue, fontSize: Number(fontSize) || 18, color: textColor || '#111111', bold: false };
      remember([...items, item]); setSelected(item.id); setTool('select'); return;
    }
    if (tool === 'image') {
      imageRef.current?.click();
      setPendingImagePoint(p);
      return;
    }
    const hit = [...pageItems].reverse().find(it => p.x >= it.x && p.x <= it.x + it.w && p.y >= it.y && p.y <= it.y + it.h);
    setSelected(hit?.id || null);
    if (hit) {
      e.preventDefault();
      wrapRef.current.setPointerCapture(e.pointerId);
      const nearCorner = p.x >= hit.x + hit.w - 0.055 && p.y >= hit.y + hit.h - 0.055;
      setDrag({ kind: nearCorner ? 'resize' : 'move', id: hit.id, offsetX: p.x - hit.x, offsetY: p.y - hit.y, startX: hit.x, startY: hit.y, startW: hit.w, startH: hit.h });
    } else {
      e.preventDefault();
      wrapRef.current.setPointerCapture(e.pointerId);
      const scroller = wrapRef.current.parentElement;
      setDrag({ kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startScrollLeft: scroller.scrollLeft, startScrollTop: scroller.scrollTop });
    }
  };

  const [pendingImagePoint, setPendingImagePoint] = useState(null);
  const onPointerMove = (e) => {
    if (!drag || !wrapRef.current) return;
    const p = pointFromEvent(e);
    if (drag.kind === 'cover') setDrag(old => ({ ...old, current: p }));
    if (drag.kind === 'pan') {
      const scroller = wrapRef.current.parentElement;
      scroller.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startClientX);
      scroller.scrollTop = drag.startScrollTop - (e.clientY - drag.startClientY);
    }
    if (drag.kind === 'move') {
      const next = items.map(it => it.id === drag.id ? { ...it, x: clamp(p.x - drag.offsetX, 0, 1 - it.w), y: clamp(p.y - drag.offsetY, 0, 1 - it.h) } : it);
      setItems(next);
    }
    if (drag.kind === 'resize') {
      const next = items.map(it => it.id === drag.id ? { ...it, w: clamp(p.x - drag.startX, 0.025, 1 - drag.startX), h: clamp(p.y - drag.startY, 0.018, 1 - drag.startY) } : it);
      setItems(next);
    }
  };
  const onPointerUp = () => {
    if (!drag) return;
    if (drag.kind === 'cover') {
      const x = Math.min(drag.start.x, drag.current.x), y = Math.min(drag.start.y, drag.current.y);
      const w = Math.abs(drag.current.x - drag.start.x), h = Math.abs(drag.current.y - drag.start.y);
      if (w > 0.004 && h > 0.004) {
        const item = { id: uid(), page, type: 'cover', x, y, w, h, color: '#ffffff' };
        remember([...items, item]); setSelected(item.id); setTool('select');
      }
    } else if (drag.kind === 'move' || drag.kind === 'resize') {
      setHistory(old => [...old.slice(-29), items]);
    }
    setDrag(null);
  };

  const applyOriginalTextEdit = (coverOnly = false) => {
    if (!originalSelected) return;
    const cover = {
      id: uid(), page, type: 'cover',
      x: originalSelected.x, y: originalSelected.y,
      w: originalSelected.w, h: originalSelected.h,
      color: originalCoverColor || '#ffffff'
    };
    const nextItems = [...items, cover];
    if (!coverOnly) {
      const replacement = {
        id: uid(), page, type: 'text',
        x: originalSelected.x, y: originalSelected.y,
        w: originalSelected.w, h: originalSelected.h,
        text: originalTextValue || originalSelected.text,
        fontSize: Number(originalFontSize) || Math.max(8, Math.round(originalSelected.h * pageSize.current.height * 0.8)),
        color: originalTextColor || '#111111',
        bold: false
      };
      nextItems.push(replacement);
      setSelected(replacement.id);
      setMessage('নির্বাচিত PDF লেখা কভার করে নতুন রঙের লেখা বসানো হয়েছে। প্রয়োজনে নতুন লেখাটি Resize করুন।');
    } else {
      setSelected(cover.id);
      setMessage('নির্বাচিত PDF লেখাটি কভার করা হয়েছে।');
    }
    remember(nextItems);
    setOriginalSelected(null);
    setOriginalTextValue('');
  };

  const addImage = async (f) => {
    if (!f || !pendingImagePoint) return;
    if (!f.type.startsWith('image/')) { setMessage('একটি image ফাইল নির্বাচন করুন।'); return; }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(f);
    });
    const img = new Image();
    img.onload = () => {
      const w = 0.24, h = Math.min(0.24 * img.height / img.width, 0.55);
      const item = { id: uid(), page, type: 'image', x: clamp(pendingImagePoint.x, 0, 1-w), y: clamp(pendingImagePoint.y, 0, 1-h), w, h, dataUrl, mime: f.type };
      remember([...items, item]); setSelected(item.id); setTool('select'); setPendingImagePoint(null); setMessage('ছবি যোগ হয়েছে। প্রয়োজন হলে টেনে সরান।');
    };
    img.onerror = () => setMessage('ছবিটি খোলা যায়নি।');
    img.src = dataUrl;
  };

  const deleteSelected = () => {
    if (!selected) return;
    remember(items.filter(it => it.id !== selected)); setSelected(null);
  };
  const copySelected = () => {
    const found = items.find(it => it.id === selected);
    if (found) { setClipboard({ ...found }); setMessage('নির্বাচিত object কপি হয়েছে।'); }
  };
  const pasteItem = () => {
    if (!clipboard) return;
    const item = { ...clipboard, id: uid(), page, x: clamp(clipboard.x + 0.025, 0, 1 - clipboard.w), y: clamp(clipboard.y + 0.025, 0, 1 - clipboard.h) };
    remember([...items, item]); setSelected(item.id);
  };
  const undo = () => {
    if (!history.length) return;
    setItems(history[history.length - 1]); setHistory(old => old.slice(0, -1)); setSelected(null);
  };

  const exportPdf = async () => {
    if (!pdfBytes) return;
    setBusy(true); setMessage('সম্পাদিত PDF তৈরি হচ্ছে…');
    try {
      const out = await PDFDocument.load(pdfBytes.slice(0));
      const pages = out.getPages();
      for (const it of items) {
        const target = pages[it.page - 1];
        if (!target) continue;
        const { width, height } = target.getSize();
        const x = it.x * width, yTop = it.y * height, w = it.w * width, h = it.h * height;
        if (it.type === 'cover') {
          target.drawRectangle({ x, y: height - yTop - h, width: w, height: h, color: (() => { const hex = (it.color || '#ffffff').replace('#', ''); return { type: 'RGB', red: parseInt(hex.slice(0,2),16)/255, green: parseInt(hex.slice(2,4),16)/255, blue: parseInt(hex.slice(4,6),16)/255 }; })() });
        } else if (it.type === 'image') {
          const bytes = await (await fetch(it.dataUrl)).arrayBuffer();
          const embedded = it.mime === 'image/png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
          target.drawImage(embedded, { x, y: height - yTop - h, width: w, height: h });
        } else if (it.type === 'text') {
          const canvas = document.createElement('canvas');
          const pxFont = Math.max(12, it.fontSize * 2);
          const ctx = canvas.getContext('2d');
          ctx.font = (it.bold ? 'bold ' : '') + pxFont + 'px Arial, sans-serif';
          const lines = String(it.text).split('\n');
          const lineHeight = pxFont * 1.25;
          const measured = Math.max(120, ...lines.map(line => ctx.measureText(line).width + 12));
          canvas.width = Math.ceil(measured); canvas.height = Math.ceil(lineHeight * lines.length + 12);
          const draw = canvas.getContext('2d');
          draw.font = (it.bold ? 'bold ' : '') + pxFont + 'px Arial, sans-serif'; draw.fillStyle = it.color || '#111111'; draw.textBaseline = 'top';
          lines.forEach((line, i) => draw.fillText(line, 5, 5 + i * lineHeight));
          const png = await out.embedPng(canvas.toDataURL('image/png'));
          target.drawImage(png, { x, y: height - yTop - h, width: w, height: h });
        }
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const name = (file?.name || 'document.pdf').replace(/\.pdf$/i, '') + '-edited.pdf';
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(url); setDownloadName(name);
      setMessage('সম্পাদিত PDF-এর Preview তৈরি হয়েছে। ভালোভাবে দেখে তারপর Download চাপুন।');
    } catch (err) {
      setMessage('PDF তৈরি করা যায়নি: ' + (err?.message || 'অজানা সমস্যা'));
    } finally { setBusy(false); }
  };

  const selectedItem = items.find(it => it.id === selected);
  return <div className="pdf-editor">
    <div className="pdf-editor-heading"><div><span className="pdf-editor-kicker">PDF WORKSPACE</span><h2>PDF Editor</h2><p>মূল PDF রেখে তার ওপর লেখা, ছবি ও whiteout যোগ করুন।</p></div>
      {pdfDoc && <button className="pdf-save" onClick={exportPdf} disabled={busy}><Download size={16}/>{busy ? 'Working…' : 'Save & Download'}</button>}
    </div>
    {!pdfDoc ? <label className="pdf-upload"><input type="file" accept="application/pdf,.pdf" onChange={e => loadFile(e.target.files?.[0])} hidden/><UploadCloud size={30}/><b>{busy ? 'PDF খোলা হচ্ছে…' : 'PDF নির্বাচন করুন'}</b><span>আপনার ফোন বা কম্পিউটার থেকে PDF আপলোড করুন</span><small>ফাইল এই ব্রাউজারেই প্রসেস হবে</small></label> :
    <>
      <div className="pdf-toolbar">
        <button className={tool==='select'?'chosen':''} onClick={()=>setTool('select')}><MousePointer2 size={16}/> Select / Move</button>
        <button className={tool==='cover'?'chosen':''} onClick={()=>setTool('cover')}><Eraser size={16}/> Cover area</button>
        <button className={tool==='text'?'chosen':''} onClick={()=>setTool('text')}><Type size={16}/> Add text</button>
        <button className={tool==='image'?'chosen':''} onClick={()=>setTool('image')}><ImagePlus size={16}/> Add image</button>
        <button onClick={copySelected} disabled={!selected}><Copy size={16}/> Copy</button>
        <button onClick={pasteItem} disabled={!clipboard}><ClipboardPaste size={16}/> Paste</button>
        <button onClick={undo} disabled={!history.length}><Undo2 size={16}/> Undo</button>
        <button onClick={deleteSelected} disabled={!selected}><Trash2 size={16}/> Delete</button>
      </div>
      {tool==='text' && <div className="pdf-text-controls"><input value={textValue} onChange={e=>setTextValue(e.target.value)} placeholder="এখানে নতুন লেখা লিখুন"/><label>Size <input type="number" min="8" max="72" value={fontSize} onChange={e=>setFontSize(e.target.value)}/></label><label>Text color <input aria-label="New text colour" type="color" value={textColor} onChange={e=>setTextColor(e.target.value)}/></label><span>লেখার রং বেছে নিয়ে তারপর পৃষ্ঠায় যেখানে বসাতে চান সেখানে ট্যাপ করুন।</span></div>}
      {selectedItem?.type === 'text' && <div className="pdf-text-controls"><input aria-label="Selected text" value={selectedItem.text} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,text:e.target.value}:it))}/><label>Size <input type="number" min="8" max="72" value={selectedItem.fontSize || 18} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,fontSize:Number(e.target.value)||18}:it))}/></label><label>Color <input aria-label="Text colour" type="color" value={selectedItem.color || '#111111'} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,color:e.target.value}:it))}/></label><label style={{display:'inline-flex',alignItems:'center',gap:5}}>Bold <input type="checkbox" checked={!!selectedItem.bold} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,bold:e.target.checked}:it))}/></label><label>X % <input type="number" min="0" max="100" value={Math.round(selectedItem.x*100)} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,x:clamp((Number(e.target.value)||0)/100,0,1-it.w)}:it))}/></label><label>Y % <input type="number" min="0" max="100" value={Math.round(selectedItem.y*100)} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,y:clamp((Number(e.target.value)||0)/100,0,1-it.h)}:it))}/></label><span>লেখার রং, Bold ও পৃষ্ঠায় অবস্থান এখান থেকে বদলান; Preview-তে সঙ্গে সঙ্গে দেখা যাবে।</span></div>}
      <input ref={imageRef} type="file" accept="image/png,image/jpeg" hidden onChange={e=>addImage(e.target.files?.[0])}/>
      <div className="pdf-page-controls"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}><ChevronLeft size={17}/></button><span>Page {page} / {pageCount}</span><button onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page>=pageCount}><ChevronRight size={17}/></button><i/><button onClick={()=>setScale(s=>Math.max(.55,s-.1))}><ZoomOut size={16}/></button><span>{Math.round(scale*100)}%</span><button onClick={()=>setScale(s=>Math.min(1.8,s+.1))}><ZoomIn size={16}/></button></div>
      <div className="pdf-canvas-scroll"><div className="pdf-page-wrap" ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <canvas ref={canvasRef}/>
        {pageItems.map(it => <div key={it.id} className={'pdf-overlay '+(selected===it.id?'is-selected':'')} style={{left:(it.x*100)+'%',top:(it.y*100)+'%',width:(it.w*100)+'%',height:(it.h*100)+'%',background:it.type==='cover'?(it.color || '#ffffff'):'transparent',border: selected===it.id?'2px solid #796df2':it.type==='cover'?'1px dashed #aaa':'1px dashed #796df2',color:'#111',fontSize:Math.max(9,(it.fontSize || 18)*scale*.72)+'px',fontWeight:it.bold?'700':'400',color:it.color || '#111111'}}>{it.type==='text'?it.text:it.type==='image'?<img src={it.dataUrl} alt="Added image"/>:null}</div>)}
        {drag?.kind==='cover'&&<div className="pdf-cover-preview" style={{left:Math.min(drag.start.x,drag.current.x)*100+'%',top:Math.min(drag.start.y,drag.current.y)*100+'%',width:Math.abs(drag.current.x-drag.start.x)*100+'%',height:Math.abs(drag.current.y-drag.start.y)*100+'%'}}/>}
      </div></div>
      <div className="pdf-editor-hint">{tool==='cover'?'আঙুল চেপে ধরে টেনে কভার আঁকুন। তৈরি হলে নিচের ডান কোণার হ্যান্ডেল টেনে আকার বদলান, মাঝখান ধরে সরান।':tool==='text'?'লেখা লিখে পৃষ্ঠায় ট্যাপ করুন।':tool==='image'?'Add image চাপুন, তারপর ছবিটি নির্বাচন করুন।':'যোগ করা লেখা/ছবি/কভার ট্যাপ করে সরান বা কপি করুন।'}</div>
      {selectedItem && <div className="pdf-selected-info">Selected: {selectedItem.type} · Page {selectedItem.page} {selectedItem.type === 'cover' && <><label style={{display:'inline-flex',alignItems:'center',gap:8,marginLeft:12}}>Cover colour <input aria-label="Cover colour" type="color" value={selectedItem.color || '#ffffff'} onChange={e=>setItems(old=>old.map(it=>it.id===selectedItem.id?{...it,color:e.target.value}:it))}/></label><button onClick={()=>{setTool('select');setSampleColorMode(true);setMessage('PDF-এর Cover-এর বাইরের যে জায়গার রং নিতে চান, সেখানে ট্যাপ করুন।')}}>PDF থেকে রং নিন</button></>} <button onClick={deleteSelected}>Remove</button></div>}
    </>}
    {message && <div className="pdf-editor-message">{message}</div>}
    {downloadUrl && <section className="pdf-export-preview" style={{marginTop:16,padding:12,border:'1px solid #7775',borderRadius:12}}>
      <h3 style={{margin:'0 0 10px'}}>সম্পাদিত PDF Preview</h3>
      <iframe title="Edited PDF preview" src={downloadUrl} style={{width:'100%',height:'70vh',minHeight:420,border:'1px solid #888',borderRadius:8,background:'#fff'}}/>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
        <a href={downloadUrl} target="_blank" rel="noreferrer" style={{padding:'10px 14px',border:'1px solid currentColor',borderRadius:8}}>নতুন ট্যাবে Preview</a>
        <a href={downloadUrl} download={downloadName} style={{padding:'10px 14px',background:'#6256d9',color:'#fff',borderRadius:8,fontWeight:700}}>Download edited PDF</a>
      </div>
    </section>}
    <div className="pdf-editor-note"><b>গুরুত্বপূর্ণ:</b> Cover area নির্বাচিত জায়গার ওপর রঙের অংশ বসায়; নিচের পুরোনো লেখা/ছবি PDF-এর ভেতরে থাকে। জটিল ব্যাকগ্রাউন্ড স্বয়ংক্রিয়ভাবে পুনর্গঠন করা হয় না। সম্পাদিত কপি ডাউনলোড হবে, আসল ফাইল বদলাবে না।</div>
  </div>;
}
