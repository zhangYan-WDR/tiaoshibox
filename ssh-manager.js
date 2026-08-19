const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Hook ssh2 key parser and dynamic packet rewriting for SSH User Certificates
try {
  const keyParser = require('ssh2/lib/protocol/keyParser.js');
  const originalParseKey = keyParser.parseKey;
  keyParser.parseKey = function(data, passphrase) {
    const parsedKey = originalParseKey.call(this, data, passphrase);
    if (parsedKey && !(parsedKey instanceof Error) && data && data.certBuffer) {
      try {
        parsedKey.type = data.certType;
        parsedKey.getPublicSSH = () => data.certBuffer;
      } catch (e) {
        console.error('User cert hook: Failed to decorate private key:', e);
      }
    }
    return parsedKey;
  };

  const utils = require('ssh2/lib/protocol/utils.js');
  const originalConvertSignature = utils.convertSignature;
  utils.convertSignature = function(signature, keyType) {
    let mappedKeyType = keyType;
    if (typeof keyType === 'string' && keyType.endsWith('-cert-v01@openssh.com')) {
      mappedKeyType = keyType.replace('-cert-v01@openssh.com', '');
    }
    return originalConvertSignature.call(this, signature, mappedKeyType);
  };

  const originalSendPacket = utils.sendPacket;
  utils.sendPacket = function(proto, packet, bypass) {
    const allocStart = proto._packetRW.write.allocStart;
    const pktType = packet ? packet[allocStart] : null;
    
    if (packet && pktType === 50 && !bypass) {
      try {
        let pos = allocStart + 1;
        const readString = () => {
          const len = packet.readUint32BE(pos);
          pos += 4;
          const str = packet.toString('utf8', pos, pos + len);
          pos += len;
          return { len, str, start: pos - len - 4 };
        };
        
        const user = readString();
        const service = readString();
        const method = readString();
        
        if (method.str === 'publickey') {
          const isSigned = packet[pos++];
          if (isSigned === 1) {
            const algo = readString();
            const pubkey = readString();
            
            const sigBlockStart = pos;
            const sigBlockLen = packet.readUint32BE(pos);
            pos += 4;
            
            const sigAlgo = readString();
            if (sigAlgo.str.endsWith('-cert-v01@openssh.com')) {
              const newSigAlgo = sigAlgo.str.replace('-cert-v01@openssh.com', '');
              const newSigAlgoLen = Buffer.byteLength(newSigAlgo);
              
              const sigBlobLen = packet.readUint32BE(pos);
              const sigBlob = packet.slice(pos + 4, pos + 4 + sigBlobLen);
              
              const newSigBlock = Buffer.allocUnsafe(4 + newSigAlgoLen + 4 + sigBlobLen);
              newSigBlock.writeUint32BE(newSigAlgoLen, 0);
              newSigBlock.utf8Write(newSigAlgo, 4, newSigAlgoLen);
              newSigBlock.writeUint32BE(sigBlobLen, 4 + newSigAlgoLen);
              sigBlob.copy(newSigBlock, 4 + newSigAlgoLen + 4);
              
              const part1 = packet.slice(0, sigBlockStart);
              const lenBuf = Buffer.allocUnsafe(4);
              lenBuf.writeUint32BE(newSigBlock.length, 0);
              
              const newPacketBody = Buffer.concat([part1.slice(allocStart), lenBuf, newSigBlock]);
              
              const newPacket = proto._cipher.allocPacket(newPacketBody.length);
              newPacket.set(newPacketBody, allocStart);
              packet = newPacket;
            }
          }
        }
      } catch (e) {
        // Silently ignore parsing errors for non-auth packets
      }
    }
    return originalSendPacket.call(this, proto, packet, bypass);
  };
} catch (e) {
  console.error('Failed to initialize user cert hooks:', e);
}

const { Client } = require('ssh2');

class SSHManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // id -> { client, stream, sftp, host, port, username }
  }

  /**
   * Establish SSH Connection and open shell channel
   */
  connect(id, config, mainWindow) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let resolved = false;

      conn.on('ready', () => {
        conn.shell({ term: 'xterm-color', cols: 80, rows: 24 }, (err, stream) => {
          if (err) {
            conn.end();
            if (!resolved) {
              resolved = true;
              reject(err);
            }
            return;
          }

          // Register stream data events
          stream.on('data', (data) => {
            if (mainWindow) {
              mainWindow.webContents.send('ssh:data', {
                sessionId: id,
                data: data.toString('utf-8')
              });
            }
          });

          stream.on('close', () => {
            console.log(`[SSH] Stream closed for session ${id}`);
            this.disconnect(id);
            if (mainWindow) {
              mainWindow.webContents.send('ssh:status', {
                sessionId: id,
                status: 'disconnected'
              });
            }
          });

          const sessionObj = {
            client: conn,
            stream: stream,
            sftp: null,
            host: config.host,
            port: config.port || 22,
            username: config.username
          };

          this.sessions.set(id, sessionObj);

          if (!resolved) {
            resolved = true;
            resolve({ success: true });
          }

          if (mainWindow) {
            mainWindow.webContents.send('ssh:status', {
              sessionId: id,
              status: 'connected',
              host: config.host,
              username: config.username
            });
          }
        });
      });

      conn.on('error', (err) => {
        console.error(`[SSH] Connection error on session ${id}:`, err.message);
        if (!resolved) {
          resolved = true;
          reject(err);
        } else {
          // Stream error to frontend if already connected
          if (mainWindow) {
            mainWindow.webContents.send('ssh:error', {
              sessionId: id,
              message: err.message
            });
          }
        }
        this.disconnect(id);
      });

      conn.on('close', () => {
        console.log(`[SSH] Connection closed for session ${id}`);
        this.disconnect(id);
        if (mainWindow) {
          mainWindow.webContents.send('ssh:status', {
            sessionId: id,
            status: 'disconnected'
          });
        }
      });

      // Prepare connection options
      const connOptions = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3
      };

      if (config.authType === 'key') {
        if (config.privateKey) {
          connOptions.privateKey = config.privateKey;
        } else if (config.privateKeyPath) {
          try {
            const pkBuffer = fs.readFileSync(config.privateKeyPath);
            const certPath = `${config.privateKeyPath}-cert.pub`;
            if (fs.existsSync(certPath)) {
              try {
                const certContent = fs.readFileSync(certPath, 'utf8');
                const parts = certContent.trim().split(/\s+/);
                if (parts.length >= 2) {
                  pkBuffer.certBuffer = Buffer.from(parts[1], 'base64');
                  pkBuffer.certType = parts[0];
                }
              } catch (certErr) {
                console.error('Failed to parse user certificate:', certErr);
              }
            }
            connOptions.privateKey = pkBuffer;
          } catch (readErr) {
            return reject(new Error(`无法读取私钥文件: ${readErr.message}`));
          }
        }
        if (config.passphrase) {
          connOptions.passphrase = config.passphrase;
        }
      } else {
        connOptions.password = config.password;
      }

      conn.connect(connOptions);
    });
  }

  /**
   * Write data to SSH shell stream (from frontend terminal input)
   */
  write(id, data) {
    const session = this.sessions.get(id);
    if (session && session.stream) {
      session.stream.write(data);
      return true;
    }
    return false;
  }

  /**
   * Resize terminal dimension
   */
  resize(id, cols, rows) {
    const session = this.sessions.get(id);
    if (session && session.stream) {
      session.stream.setWindow(rows, cols, 0, 0);
      return true;
    }
    return false;
  }

  /**
   * Disconnect session and clean up
   */
  disconnect(id) {
    const session = this.sessions.get(id);
    if (session) {
      try {
        if (session.stream) session.stream.end();
      } catch (e) {}
      try {
        if (session.client) session.client.end();
      } catch (e) {}
      this.sessions.delete(id);
      console.log(`[SSH] Session ${id} cleaned up.`);
      return true;
    }
    return false;
  }

  /**
   * Retrieve or initialize SFTP client for active SSH connection
   */
  getSftp(id) {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(id);
      if (!session) {
        return reject(new Error('SSH 链接不存在或已断开'));
      }

      if (session.sftp) {
        return resolve(session.sftp);
      }

      session.client.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }
        session.sftp = sftp;
        resolve(sftp);
      });
    });
  }

  /**
   * SFTP: List directories and files
   */
  async list(id, remotePath) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err);

        // Map files to client format
        const items = list.map(item => {
          const isDir = (item.attrs.mode & 0o170000) === 0o040000;
          const isLink = (item.attrs.mode & 0o170000) === 0o120000;
          return {
            name: item.filename,
            size: item.attrs.size,
            mtime: item.attrs.mtime * 1000,
            type: isDir ? 'd' : (isLink ? 'l' : '-'),
            permissions: item.longname ? item.longname.split(' ')[0] : ''
          };
        });

        // Sort: directories first, then alphabetically
        items.sort((a, b) => {
          if (a.type === 'd' && b.type !== 'd') return -1;
          if (a.type !== 'd' && b.type === 'd') return 1;
          return a.name.localeCompare(b.name);
        });

        resolve(items);
      });
    });
  }

  /**
   * SFTP: Create directory
   */
  async mkdir(id, remotePath) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * SFTP: Delete file
   */
  async deleteFile(id, remotePath) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * SFTP: Delete directory (rmdir)
   */
  async rmdir(id, remotePath) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * SFTP: Rename file or directory
   */
  async rename(id, oldPath, newPath) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * SFTP: Download file
   */
  async download(id, remotePath, localPath, progressCallback) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {
        step: (transferred, chunk, total) => {
          if (progressCallback) {
            progressCallback(Math.round((transferred / total) * 100));
          }
        }
      }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * SFTP: Upload file
   */
  async upload(id, localPath, remotePath, progressCallback) {
    const sftp = await this.getSftp(id);
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {
        step: (transferred, chunk, total) => {
          if (progressCallback) {
            progressCallback(Math.round((transferred / total) * 100));
          }
        }
      }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Clean up all active sessions
   */
  cleanupAll() {
    for (const id of this.sessions.keys()) {
      this.disconnect(id);
    }
  }
}

module.exports = new SSHManager();
