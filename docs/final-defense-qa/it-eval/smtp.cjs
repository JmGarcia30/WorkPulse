const net = require('node:net');
module.exports = async function receivingInbox() {
  const messages = [];
  const smtp = net.createServer(socket => {
    socket.setEncoding('utf8'); socket.write('220 localhost fixture\r\n');
    let buffer = '', data = false, content = '';
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const index = buffer.indexOf('\r\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        if (data) { if (line === '.') { messages.push(content.replace(/=\r\n/g, '').replace(/=3D/gi, '=')); data = false; content = ''; socket.write('250 queued\r\n'); } else content += line + '\r\n'; continue; }
        if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH PLAIN/i.test(line)) socket.write('235 authenticated\r\n');
        else if (/^RCPT TO:/i.test(line)) socket.write(/@fixture\.invalid>/i.test(line) ? '250 accepted\r\n' : '550 synthetic recipients only\r\n');
        else if (/^DATA$/i.test(line)) { data = true; socket.write('354 end with dot\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, { SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.address().port),SMTP_USER:'security@fixture.invalid',SMTP_PASSWORD:'synthetic-smtp-only',SMTP_SECURE:'false',EMAIL_FROM:'security@fixture.invalid',GMAIL_USER:'',GMAIL_APP_PASSWORD:'' });
  return { messages, close: () => new Promise(resolve => smtp.close(resolve)) };
};
