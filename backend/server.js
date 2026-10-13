const express=require('express'),fs=require('fs'),path=require('path'),Database=require('better-sqlite3');
const app=express(),port=process.env.PORT||8080,dbDir='/app/data',logs=path.join(__dirname,'logs');
fs.mkdirSync(dbDir,{recursive:true});fs.mkdirSync(logs,{recursive:true});
const db=new Database(path.join(dbDir,'encuestas.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,role TEXT);
CREATE TABLE IF NOT EXISTS surveys(id INTEGER PRIMARY KEY,title TEXT,description TEXT,active INTEGER);
CREATE TABLE IF NOT EXISTS choices(id INTEGER PRIMARY KEY,survey_id INTEGER,label TEXT);
CREATE TABLE IF NOT EXISTS votes(id INTEGER PRIMARY KEY,vote_token TEXT,survey_id INTEGER,choice_id INTEGER);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,survey_id INTEGER,username TEXT,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
if(!db.prepare('SELECT COUNT(*) n FROM users').get().n){
 const u=db.prepare('INSERT INTO users(username,password,role) VALUES(?,?,?)');
 u.run('fede','fede123','student');u.run('admin','admin123','admin');u.run('superadmin','super123','superadmin');
 db.prepare('INSERT INTO surveys VALUES(1,?,?,1)').run('¿Estás de acuerdo con el nuevo régimen de cursadas?','Encuesta institucional de ejemplo.');
 db.prepare('INSERT INTO surveys VALUES(2,?,?,1)').run('¿Qué materias deberían abrirse el próximo cuatrimestre?','Encuesta para alumnos.');
 const c=db.prepare('INSERT INTO choices(survey_id,label) VALUES(?,?)');[['Sí',1],['No',1],['No sabe / no contesta',1],['Bases de Datos',2],['Seguridad Web',2]].forEach(x=>c.run(x[1],x[0]));
 const v=db.prepare('INSERT INTO votes(vote_token,survey_id,choice_id) VALUES(?,?,?)');for(let i=0;i<10;i++)v.run('demo-'+i,1,i%2?2:1);v.run('demo-10',2,4);
}
if(!fs.existsSync(path.join(logs,'activity.log')))fs.writeFileSync(path.join(logs,'activity.log'),'2026-10-12 INFO Encuesta 1 consultada\n');
if(!fs.existsSync(path.join(logs,'app.log')))fs.writeFileSync(path.join(logs,'app.log'),'INFO API iniciada\nDB_URL=sqlite://data/encuestas.sqlite\nDB_PASSWORD=obfuscated-demo-value\nEndpoint interno: GET /api/admin/votes?vote_id=xxxx\n');
app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:false}));app.use(express.static(path.join(__dirname,'public')));
const jwt=p=>Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(p)).toString('base64url')+'.';
function user(req){let c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('SESSION_TOKEN='));try{return c?JSON.parse(Buffer.from(decodeURIComponent(c.slice(14)).split('.')[1],'base64url').toString()):null}catch{return null}}
function auth(req,res,next){req.u=user(req);if(!req.u?.username)return res.status(401).json({error:'Iniciá sesión'});next()}
function role(req,res,next){req.u=user(req);if(!req.u||!['admin','superadmin'].includes(req.u.role))return res.status(403).json({error:'Acceso denegado'});next()}
function log(s){fs.appendFileSync(path.join(logs,'activity.log'),new Date().toISOString()+' '+s+'\n')}
app.post('/api/login',(q,s)=>{let x=db.prepare('SELECT id,username,role FROM users WHERE username=? AND password=?').get(q.body.username,q.body.password);if(!x)return s.status(401).json({error:'Usuario o contraseña incorrectos'});s.setHeader('Set-Cookie','SESSION_TOKEN='+encodeURIComponent(jwt({sub:String(x.id),username:x.username,role:x.role}))+'; Path=/; SameSite=Lax');log('LOGIN '+x.username);s.json({user:x})});
app.post('/api/logout',(q,s)=>{s.setHeader('Set-Cookie','SESSION_TOKEN=; Path=/; Max-Age=0');s.json({ok:true})});
app.get('/api/me',auth,(q,s)=>s.json(q.u));
app.get('/api/surveys',auth,(q,s)=>s.json({surveys:db.prepare('SELECT * FROM surveys WHERE active=1').all(),choices:db.prepare('SELECT * FROM choices').all(),comments:db.prepare('SELECT * FROM comments ORDER BY id').all(),counts:db.prepare('SELECT survey_id,choice_id,COUNT(*) count FROM votes GROUP BY survey_id,choice_id').all()}));
app.post('/api/surveys/:id/comments',auth,(q,s)=>{db.prepare('INSERT INTO comments(survey_id,username,body) VALUES(?,?,?)').run(+q.params.id,q.u.username,String(q.body.body||''));log('COMMENT survey='+q.params.id);s.json({ok:true})});
app.post('/api/surveys/:id/vote',auth,(q,s)=>{db.prepare('INSERT INTO votes(vote_token,survey_id,choice_id) VALUES(?,?,?)').run('demo-'+Date.now(),+q.params.id,+q.body.choice_id);log('VOTE '+q.params.id);s.json({ok:true})});
app.get('/api/admin/summary',role,(q,s)=>s.json({users:db.prepare('SELECT COUNT(*) n FROM users').get().n,votes:db.prepare('SELECT COUNT(*) n FROM votes').get().n}));
app.get('/api/admin/vote-results',role,(q,s)=>s.json(db.prepare('SELECT c.label,COUNT(v.id) count FROM choices c LEFT JOIN votes v ON v.choice_id=c.id GROUP BY c.id').all()));
app.get('/api/admin/logs',role,(q,s)=>{try{s.type('text/plain').send(fs.readFileSync(path.resolve(logs,String(q.query.file||'activity.log')),'utf8'))}catch(e){s.status(404).send(e.message)}});
app.get('/api/admin/votes',role,(q,s)=>{try{let val=String(q.query.vote_id||'0'),first=val.split(';')[0],rows=db.prepare('SELECT id AS vote_id,vote_token,survey_id,choice_id FROM votes WHERE id = '+first).all(),tail=val.includes(';')?val.slice(val.indexOf(';')+1).replace(/--.*$/,''):'';if(tail.trim())db.exec(tail);log('INTERNAL_VOTES_LOOKUP');s.json({rows,note:tail?'Sentencia adicional ejecutada en el laboratorio':''})}catch(e){s.status(400).json({error:'Error SQL de laboratorio',detail:e.message})}});
app.get('/lab/collect',(q,s)=>{let v=String(q.query.cookie||'').replace(/(SESSION_TOKEN=)[^&]*/,'$1[REDACTED]');log('XSS_COLLECT '+v.slice(0,250));s.type('text/plain').send('Evento recibido localmente')});
app.get('/lab/events',auth,(q,s)=>s.json({events:fs.readFileSync(path.join(logs,'activity.log'),'utf8').split('\n').filter(x=>/XSS_COLLECT|LOGIN/.test(x))}));
app.get('/api/admin/impersonate-demo',role,(q,s)=>s.json({token:jwt({sub:'2',username:'admin',role:'admin'}),warning:'JWT alg:none de demostración local'}));
app.get('/api/lab/status',auth,(q,s)=>s.json({notice:'Vulnerabilidades intencionales de laboratorio'}));
app.get('*',(q,s)=>s.sendFile(path.join(__dirname,'public','index.html')));
app.listen(port,'0.0.0.0',()=>console.log('Encuestas Lab on '+port));
