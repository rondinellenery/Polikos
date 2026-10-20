import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root,'.env') });
if(process.env.NODE_ENV === 'production'){
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32 || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Admin@12345' || process.env.COOKIE_SECURE!=='true'){
    throw new Error('Produção exige JWT_SECRET >= 32 caracteres, ADMIN_PASSWORD personalizado e COOKIE_SECURE=true com HTTPS.');
  }
}
const {app}=await import('./app.js');
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log(`\n🏛️ POLIKOS API: http://localhost:${port}\n`));
