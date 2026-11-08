"""Build a narrated video, illustrated booklet and reusable design assets.
Run capture-tutorial.mjs first. Uses only fictional tutorial records.
"""
import asyncio,json,subprocess,textwrap,re,zipfile
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import edge_tts
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'output/tutorial'; TMP=ROOT/'tmp/tutorial'
FONT=ROOT/'apps/web/public/brand/Manrope-Regular.ttf'; BOLD=ROOT/'apps/web/public/brand/Manrope-Bold.ttf'
# Screen-matched narration and practical instructions, shared by both outputs.
DATA=[
('Start with the right role','Customer / Analyst / Administrator',
'Welcome to DisputeGuard, a showcase for managing card payment disputes. This walkthrough follows a sample missing order from the customer statement through evidence, AI assistance and human review. Sign in with a showcase persona, or use a registered account. Customers see their own records; analysts review cases; administrators manage access and monitoring. The payments are sample records, with no bank connection or movement of money.',
['Open http://localhost:3100/console with the stack running.','For this tutorial, choose Thabo Nkosi under Customer.','Registered users use their email and password; invited users first accept their invitation.']),
('Understand your dashboard','Your visible portfolio at a glance',
'The dashboard gives you a quick view of the records available to your role. Use the totals and recent activity to understand your workload, then move through the sidebar to the statement, transactions or disputes. The same console adapts to each role. A customer sees a personal view, while staff can review the wider portfolio. Use the named sections to follow one payment all the way through its case.',
['Review the portfolio totals and recent activity.','Use Bank statement for the guided customer journey.','Use Transactions and Disputes to find a specific record.']),
('Check a payment','Rules explain why a payment needs review',
'Open Bank statement and select Check for possible disputes. The application checks configured patterns such as large payments, unusual amounts and possible duplicates. These are explainable review flags, produced by rules. They do not establish fraud and do not automatically create a case. Compare the payment with your own records. You can still raise a concern even when no rule flags it. Search by merchant or payment number to narrow the list.',
['Open Bank statement, then Check for possible disputes.','Read the reasons for any review flags.','Search for the merchant or payment number you want to inspect.']),
('Explain what went wrong','A customer opens the case',
'For this tutorial, we added a clearly labelled sample order worth two thousand seven hundred and fifty rand. Choose Review payment, describe what went wrong, then select Submit dispute. The example explains that an order did not arrive. The server checks who owns the payment and prevents duplicate active disputes. The concern becomes a submitted case that can be tracked in Disputes. Creating a case does not reverse the payment.',
['Find Tutorial Store - sample order in Bank statement.','Choose Review payment and describe the missing order.','Select Submit dispute, then find the case in Disputes.']),
('Provide supporting evidence','Attach documents to the case',
'In the case workspace, attach supporting evidence such as a receipt, order confirmation or merchant correspondence. This recording uploads a fictional receipt. The interface accepts PDF, PNG and JPEG files up to five megabytes each. Files are format checked and linked to the case; malware scanning is not configured. Download file lets an authorised user retrieve the attachment. Evidence remains supporting material for a person to assess.',
['Select Inspect beside your case in Disputes.','Use Attach evidence to select a PDF, PNG or JPEG up to 5 MB.','Confirm the attachment appears; add relevant merchant correspondence when available.']),
('Ask a question in plain language','Scoped records -> explanation -> next steps',
'Ask assistant is the conversational AI feature. Select the investigation scope, then ask about a payment or case. Here we ask what happened to the sample order and what evidence to provide. The server gathers only records visible to the signed in user, checks case progress and evidence metadata, and asks the local Ollama model for an explanation. The answer label identifies a local model response or a rules based response. The assistant cannot approve cases or move money.',
['Open Ask assistant and select the tutorial payment as the scope.','Ask: What evidence should I provide for an order that did not arrive?','Read the answer and its source label; verify suggestions against the actual records.']),
('Move into analyst review','The server checks every transition',
'Switch to the analyst persona, Nomsa Mahlangu, and open the same case from the queue. The workspace shows the current state, version, advisory risk, reason code, required evidence and deadline information. Choose begin review, followed by begin investigation when the available evidence supports that step. Available actions depend on both the user role and the current state. Each update is checked by the server, including the case version to prevent conflicting edits.',
['Sign out and choose analyst Nomsa Mahlangu.','Open Disputes and Inspect the tutorial case.','Use begin review, then begin investigation; request evidence instead if more material is needed.']),
('Watch the bounded AI loop','Allowlisted proposals with a fixed budget',
'Run bounded investigation is a separate AI workflow inside the case. The application assembles the transaction, evidence metadata and advisory risk signals. Ollama proposes a read only step or a stop. Application code validates proposals against three allowed tool names and enforces a default limit of three iterations and three tool calls. The visible history records observations and the stopping outcome. Context is supplied up front, without database browsing or document reading. In this recording, the model misstates the amount and currency. The source payment is two thousand seven hundred and fifty rand. Verify the original record.',
['Select Run bounded investigation in the case workspace.','Read the source label, summary, stage, observation count and recorded history.','Allowed steps: get_transaction, get_evidence_metadata and get_risk_signals. Verify every amount against the source payment.']),
('Keep the decision human','Review findings, then export the record',
'An AI summary is advisory. An authorised analyst or administrator must assess the evidence and choose the case outcome. This demonstration approves the tutorial case after review; that changes the case state only. No refund or money transfer takes place. Download case report creates a branded PDF containing case information and available evidence attachments. Keep the report with your review record and compare the outcome with the audit history.',
['Review the original payment, attachments and AI output together.','While investigating, authorised staff can approve or reject the case.','Choose Download case report to save a portable case record.']),
('Revisit investigation records','A history of advisory runs',
'The Investigations section lists saved investigation records with their source, summary and activity counts. Use it to revisit what the assistant produced rather than treating a single answer as a final decision. A local model label means a model supplied valid output during that run. A fallback label means deterministic behaviour was used. Model availability and response quality can change, so always read the recorded outcome and return to the underlying case evidence.',
['Open Investigations from the sidebar.','Review the saved summary and model or fallback label.','Use case evidence and human judgement when interpreting the result.']),
('Check the audit trail','Ordered events with integrity verification',
'The Audit log records dispute lifecycle events in order, including the actor and state changes. The application uses a SHA two hundred and fifty six hash chain to make changes to the recorded sequence detectable through verification. This helps explain how the case reached its current state. It is an integrity check on the stored log, not proof that every business decision was correct. Compare the final outcome with the case timeline and exported report.',
['Open Audit log and review the ordered case events.','Check the verification result shown by the interface.','Compare actors and transitions with the case timeline.']),
('Follow progress and updates','In-app activity and configured email',
'Return to the customer view and open Notifications. Case and evidence activity appear in the inbox, where you can open the associated record and mark updates as read. Email preferences are separate. The interface shows whether email is in preview mode or SMTP delivery mode. Preview emails remain inside the application; SMTP mode can send to the saved address when enabled. No email is sent as part of this walkthrough.',
['Open Notifications to read activity and visit related cases.','Check the displayed email mode before using its controls.','Save an email preference only when you want updates through the configured mode.']),
('Monitor the sample portfolio','Administrator checks remain advisory',
'As administrator Mandla Ndlovu, open Monitoring. Scan once checks the sample portfolio immediately. Administrators can also start recurring monitoring and choose the interval and large payment threshold. Monitoring runs in the server process and pauses when the server is offline. Flags notify customers and staff for review, without automatically creating a case or deciding a payment outcome. These monitoring checks are deterministic rules, separate from the language model assistant.',
['Sign in as Mandla Ndlovu and open Monitoring.','Choose Scan once to view current review flags.','For recurring checks, set the threshold and interval, then Start monitoring.']),
('Manage people and permissions','Administrator onboarding controls',
'People and access is the administrator workspace for customers, staff invitations and sample payment entry. New registered customers begin with an empty statement; an administrator can add showcase payments for the appropriate owner. Invitations provide the account acceptance journey. Use the correct role for each person because it controls what they can see and do. This recording only inspects the page and does not send invitations or change anyone else’s access.',
['Open People & access as an administrator.','Review account roles and onboarding controls.','When onboarding is needed, invite the intended person with the appropriate role.']),
('Make the console yours','Theme, language and quick navigation',
'The console supports light and dark themes, English, isiZulu and Afrikaans navigation, plus a command palette for quick access. The recording finishes in the light theme. To repeat the tutorial, start with the customer statement, open a concern, attach evidence, ask the assistant and move to staff review. The essential pattern stays the same: scoped records, explainable assistance, server checked actions and a human decision supported by an audit trail.',
['Use the theme button to switch between light and dark.','Choose English, isiZulu or Afrikaans from Language.','Open the command palette for quick navigation to a section.'])]

def run(args): return subprocess.run([str(x) for x in args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
def wrap(draw,text,font,width):
    words=text.split();lines=[];line=''
    for w in words:
        test=(line+' '+w).strip()
        if draw.textlength(test,font=font)>width and line:lines.append(line);line=w
        else:line=test
    if line:lines.append(line)
    return lines
def frame(i,title,subtitle,steps):
    im=Image.new('RGB',(1920,1080),'#081422');d=ImageDraw.Draw(im)
    def txt(s,xy,size=28,color='#eff6ff',bold=False,width=350,leading=None):
        f=ImageFont.truetype(str(BOLD if bold else FONT),size);x,y=xy
        for line in wrap(d,s,f,width):d.text((x,y),line,font=f,fill=color);y+=leading or size*1.42
        return y
    txt('ADGSTUDIOS / DISPUTEGUARD',(48,35),21,'#6de3d2',True,1800)
    txt(f'{i+1:02d} / 15',(48,145),32,'#6de3d2',True)
    y=txt(title,(48,220),43,bold=True,width=335)
    y=txt(subtitle,(48,y+25),24,'#9db2c9',width=335)
    for j,step in enumerate(steps[:2]):y=txt(f'{j+1}. '+step,(48,y+40),22,width=335)
    txt('SAMPLE RECORDS | NARRATED APP WALKTHROUGH',(48,1030),17,'#9db2c9',width=1800)
    d.rounded_rectangle((425,98,1902,1024),radius=14,outline='#29415c',width=2)
    im.save(TMP/f'frame-{i:02}.png')

async def voices(scenes):
    for i,s in enumerate(scenes):
        target=TMP/f'voice-{i:02}.mp3'
        if not target.exists():
            await edge_tts.Communicate(DATA[i][2],voice='en-ZA-LukeNeural',rate='+3%').save(str(target))
        print('Narration',i+1,flush=True)

def booklet(scenes,modes):
    pdfmetrics.registerFont(TTFont('Manrope',str(FONT)));pdfmetrics.registerFont(TTFont('ManropeBold',str(BOLD)))
    c=canvas.Canvas(str(OUT/'disputeguard-tutorial.pdf'),pagesize=(595.28,841.89));c.setTitle('DisputeGuard - Illustrated tutorial and AI guide');c.setAuthor('ADGSTUDIOS')
    def text(t,x,y,size=11,color='#233951',font='Manrope',width=510,leading=None):
        c.setFont(font,size);c.setFillColor(HexColor(color));line=''
        for w in t.split():
            test=(line+' '+w).strip()
            if pdfmetrics.stringWidth(test,font,size)>width and line:c.drawString(x,y,line);y-=leading or size*1.5;line=w
            else:line=test
        if line:c.drawString(x,y,line);y-=leading or size*1.5
        return y
    def base(n,label):
        c.setFillColor(HexColor('#f4f7fb'));c.rect(0,0,596,842,fill=1,stroke=0)
        text('ADGSTUDIOS  /  DISPUTEGUARD',36,806,9,'#187c75','ManropeBold');text(label,36,783,9,'#61758a')
        c.setStrokeColor(HexColor('#d4dee9'));c.line(36,39,559,39);text('Showcase tutorial | 8 November 2026',36,24,8,'#61758a');text(str(n),540,24,8,'#61758a')
    base(1,'ILLUSTRATED USER GUIDE')
    text('From payment',36,709,38,font='ManropeBold');text('to reviewed case.',36,655,38,font='ManropeBold')
    text('A practical guide to the app, its two AI workflows, and the human decisions that complete a dispute.',36,594,15,width=480)
    c.drawImage(str(OUT/'screenshots/02-dashboard.png'),36,214,width=523,height=327)
    text('Start here',36,174,16,font='ManropeBold');text('Customer journey: pages 2-7  |  Staff review: pages 8-12',36,145,11);text('Notifications and admin: pages 13-16  |  AI explained: page 17',36,124,11)
    text('Fictional tutorial records. No bank feed, refund execution or movement of money.',36,82,10,'#61758a');c.showPage()
    for i,s in enumerate(scenes):
        title,subtitle,narr,steps=DATA[i];base(i+2,f'CHAPTER {i+1:02} / 15')
        y=text(title,36,741,25,font='ManropeBold');text(subtitle,36,y-5,12,'#187c75')
        c.drawImage(str(OUT/'screenshots'/f'{s["id"]}.png'),36,326,width=523,height=327)
        y=296
        for j,st in enumerate(steps):y=text(f'{j+1}. {st}',36,y,11,font='ManropeBold')-6
        y=text(narr,36,y-8,10.2,width=523,leading=15)
        if y<52:raise ValueError(f'PDF overflow page {i+2}: {y}')
        c.showPage()
    base(17,'AI EXPLAINED / IMPLEMENTATION NOTES')
    text('What the AI actually does',36,739,25,font='ManropeBold')
    y=693
    sections=[('01  Conversational assistant','Signed-in user -> authorised payment scope -> statement, case and evidence metadata + rule findings -> local Ollama -> explanatory answer. The source label distinguishes a local-model answer from a rules-based answer.'),('02  Bounded case investigation','Authorised case -> preassembled transaction, evidence count and risk context -> model proposes a tool name or stop -> application checks the allowlist and budget -> observation history -> advisory summary -> human review.'),('03  What the tool history means','The current loop validates named proposals and records observation counts. Context is supplied up front. It is not an agent executing arbitrary database queries, browsing the web or reading attached PDF/image contents. Evidence metadata is not document understanding.'),('04  Limits and fallback','Default case budget: 3 iterations and 3 tool calls. Invalid or unavailable model output falls back to deterministic steps or text. A loop may stop at its budget with analysis incomplete. The summary does not mutate a case; lifecycle decisions are separate server-checked actions.'),('05  Recorded model status',modes),('06  Reproduce the experience','Start the stack with ./infra/start.sh, then open http://localhost:3100/console. Ollama needs the configured model available. Use the source labels shown by each run; never present a fallback response as a model response.')]
    for h,p in sections:y=text(h,36,y,13,'#187c75','ManropeBold')-4;y=text(p,36,y,10.5,width=523,leading=16)-18
    if y<52:raise ValueError('AI page overflow')
    c.showPage();c.save()

async def main():
    scenes=json.loads((TMP/'capture.json').read_text());assert len(scenes)==15
    responses=json.loads((TMP/'ai-responses.json').read_text());model_summary=[]
    for r in responses:
        body=r['body'];model_summary.append(('Bounded investigation' if '/investigate' in r['url'] else 'Conversational assistant')+': '+('local model used' if re.search(r'"usedModel"\s*:\s*true',body) else 'deterministic fallback used')+'.')
    modes=' '.join(model_summary)+' Recorded case-summary error: the model says $275.00, while the source payment is R2,750.00. The analyst must verify source amounts.';print(modes,flush=True)
    await voices(scenes);booklet(scenes,modes)
    raw=Path((TMP/'video-path.txt').read_text());offset=0;chapters=[];srt=[]
    for i,s in enumerate(scenes):
        title,sub,narr,steps=DATA[i];frame(i,title,sub,steps)
        voice=TMP/f'voice-{i:02}.mp3';length=max(duration(voice)+1.4, s['end']-s['start'])
        # Fast-forward long model waits, then hold the completed result during explanation.
        source_length=s['end']-s['start'];speed=min(1,8/source_length)
        filt=f"[1:v]setpts={speed}*(PTS-STARTPTS),scale=1472:920,tpad=stop_mode=clone:stop_duration={length}[screen];[0:v][screen]overlay=428:101:shortest=1[base];[3:v]scale=1472:920[still];[base][still]overlay=428:101:enable='gte(t,{max(0.2,min(8,source_length)-0.5)})',format=yuv420p[v]"
        run(['ffmpeg','-y','-loglevel','error','-loop','1','-i',TMP/f'frame-{i:02}.png','-ss',s['start'],'-t',source_length,'-i',raw,'-i',voice,'-loop','1','-i',OUT/'screenshots'/f'{s["id"]}.png','-filter_complex',filt,'-map','[v]','-map','2:a','-af','apad','-t',length,'-r','25','-c:v','libx264','-preset','fast','-crf','21','-c:a','aac','-b:a','160k',TMP/f'segment-{i:02}.mp4'])
        chapters.append((offset,length,title))
        # Sentence captions are timed across the spoken portion; included as optional subtitles.
        sentences=re.split(r'(?<=[.!?])\s+',narr);total=sum(len(x) for x in sentences);cur=offset
        def stamp(t):
            ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
        for sent in sentences:
            end=cur+(length-1.4)*len(sent)/total;srt.append(f'{len(srt)+1}\n{stamp(cur)} --> {stamp(end)}\n'+ '\n'.join(textwrap.wrap(sent,76))+'\n');cur=end
        offset+=length;print('Rendered chapter',i+1,flush=True)
    (TMP/'concat.txt').write_text('\n'.join(f"file '{TMP/f'segment-{i:02}.mp4'}'" for i in range(15)))
    (OUT/'disputeguard-tutorial.srt').write_text('\n'.join(srt))
    meta=';FFMETADATA1\ntitle=DisputeGuard - Full app and AI walkthrough\n'
    for start,length,title in chapters:meta+=f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(start*1000)}\nEND={round((start+length)*1000)}\ntitle={title}\n'
    (TMP/'chapters.txt').write_text(meta)
    run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',TMP/'concat.txt','-i',TMP/'chapters.txt','-i',OUT/'disputeguard-tutorial.srt','-map','0:v','-map','0:a','-map','2:0','-map_metadata','1','-map_chapters','1','-c','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',OUT/'disputeguard-full-walkthrough.mp4'])
    (OUT/'narration-and-chapters.md').write_text('# DisputeGuard walkthrough\n\n'+modes+'\n\n'+ '\n\n'.join(f'## {int(st)//60:02}:{int(st)%60:02} - {title}\n\n{DATA[i][2]}' for i,(st,le,title) in enumerate(chapters)))
    brief='''# Claude Design handoff - DisputeGuard

Use the supplied screenshots as the source of truth for the existing app. Design an illustrated product walkthrough and an accessible tutorial booklet with the ADGSTUDIOS DisputeGuard identity. Keep actual app capabilities accurate.

## Visual direction
Calm financial operations interface. Deep navy, teal accents, Manrope typography, restrained cards and clear status indicators. Preserve the shield identity and support light and dark themes. Screenshots are clean captures of the running app, not generated mockups. Files ending in -full show the full page.

## Story
Customer signs in -> checks statement -> describes missing order -> opens dispute -> attaches receipt -> asks assistant. Analyst reviews case -> runs bounded AI investigation -> makes human decision -> exports report. Audit, notifications, monitoring and access management complete the story.

## AI accuracy requirements
Show both conversational assistant and bounded case investigation. They use scoped server-supplied context and optional local Ollama responses. Label deterministic rules and fallback behaviour. Investigation proposals use three allowlisted read-only names and a default three-iteration / three-call budget. Context is preassembled; the loop records proposals and observations. Do not depict arbitrary autonomous tool execution, document OCR, a bank feed, automatic decisions, refunds or money transfers. Evidence metadata is not extracted document content. Monitoring is rule based.

## Included assets
15 viewport screenshots plus 15 full-page screenshots; narrated 1080p walkthrough; editable narration and chapter script; optional English subtitle file; illustrated PDF booklet; fictional case report; logo SVG and application icon. The recording uses a clearly labelled sample payment and receipt. Do not claim real banking integration or measured production results.
'''
    (OUT/'CLAUDE-DESIGN-BRIEF.md').write_text(brief)
    import shutil
    shutil.copy(ROOT/'graphics/disputeguard-logo.svg',OUT/'disputeguard-logo.svg');shutil.copy(ROOT/'graphics/applogo.png',OUT/'applogo.png')
    with zipfile.ZipFile(OUT/'claude-design-assets.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted((OUT/'screenshots').glob('*.png')):z.write(p,p.relative_to(OUT))
        for name in ['CLAUDE-DESIGN-BRIEF.md','narration-and-chapters.md','disputeguard-logo.svg','applogo.png','disputeguard-tutorial.srt']:z.write(OUT/name,name)
    print('Complete',round(offset,1),'seconds',flush=True)
if __name__=='__main__':asyncio.run(main())
