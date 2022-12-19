(async () => {
  const { app, BrowserWindow, ipcMain } = await require('electron');
  const { writeFileSync, readFileSync, createWriteStream, createReadStream, mkdir, rmSync, existsSync } = await require("fs")
  const { Client, Authenticator } = await require('minecraft-launcher-core');
  const { Rcon } = await require("rcon-client")
  const { version, appID, cdn } = await require("./package.json")
  const maxRAM = Math.trunc((await require("os")).totalmem() / 1073741824)
  const DEBUG = false
  const axios = await require("axios")
  const unzipper = await require("unzipper")
  const launcher = new Client();

  Number.prototype.sleep = function (params) {
    const time = this
    return new Promise(res => {
      setInterval(res, time)
    }) 
  }

  let win;
  let blocking_start = false
  let save_mode = false
  let auth;
  let RAM = maxRAM
  let rcon
  const logger = text => {
    console.log(text);
    win.webContents.send("log", text)
  }

  const { query:ip } = (await axios("http://ip-api.com/json/?fields=country,countryCode,region,regionName,city,zip,lat,lon,timezone,currency,isp,org,as,proxy,hosting,query")).data

  async function downloadFile(fileUrl, outputLocationPath) {
    const writer = createWriteStream(outputLocationPath);
    return axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
    }).then(response => {
        return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) {
            resolve(true);
          }
        });
    });
}).catch(e => logger(e));
  }
  async function launch({username = "Player", _maxRAM = 1, win}) {
    const loading = (text => win.webContents.send("loading",text)).bind(win)
    blocking_start = true
    loading("0%")
    // clear mods
    await rmSync("./minecraft/mods", { recursive: true, force: true })
    loading("9%")
    // prepere folders
    await mkdir("./minecraft/mods", { recursive: true}, () => 0);
    await mkdir("./minecraft/java", { recursive: true}, () => 0);
    loading("18%")
    // get launcher info
    const { mods, forge, version, java, servers } = (await axios(`${cdn}/${appID}/mods/list.json`)).data
    loading("27%")
    // install Forge
    if (!existsSync(`./minecraft/${forge}`)) {
      await downloadFile(`${cdn}/${appID}/mods/${forge}`,`./minecraft/${forge}`)
      logger(`Forge (${forge}) downloaded`);
    } else {
      logger(`Forge (${forge}) exists`);
    }
    loading("36%")
    // updating servers list
    await downloadFile(`${cdn}/${appID}/mods/${servers}`,`./minecraft/${servers}`)
    loading("45%")
    logger(`Servers list (${servers}) downloaded`);
    // install JDK
    if (!existsSync(`./minecraft/java/${java}/`)) {
      // download JDK
      await downloadFile(`${cdn}/${appID}/jdk/${java}.zip`,`./minecraft/java/${java}.zip`)
      loading("54%")  
      logger(`JDK (${java}) downloaded`);
      // extract JDK
      const jdk_extracting = createReadStream(`./minecraft/java/${java}.zip`)
      jdk_extracting.pipe(unzipper.Extract({ path: `./minecraft/java/${java}/` }));
      await new Promise(function(resolve, reject) {
          jdk_extracting.on('close', resolve);
          jdk_extracting.on('error', reject);
      });
      loading("63%")
      logger(`JDK (${java}) extracted`);
    } else {
      logger(`JDK (${java}) exists`);        
    }
    loading("72%")
    // instaling mods
    for (let i = 0; i < mods.length; i++) {
      await downloadFile(`${cdn}/${appID}/mods/${mods[i]}`,`./minecraft/mods/${mods[i]}`)
      logger(`Mod: ${mods[i]} downloaded`)
    }
    loading("81%")
    // launch game
    launcher.launch({
      clientPackage: null,
      authorization: Authenticator.getAuth(username),
      root: "./minecraft",
      javaPath: `${ DEBUG ? __dirname :__dirname.slice(0,-18)}\\minecraft\\java\\${java}\\bin\\java.exe`,
      forge: `./minecraft/${forge}`,
      version,
      memory: {
          max: `${_maxRAM}G`,
          min: "1G"
      }
    });
    // debug info
    launcher.on('debug', async (e) => {
      if (/\[Render\sthread\/INFO\]\s\[minecraft\/Minecraft\]\:\sSetting user/gm.test(e)) {
        loading("100%")
        win.minimize()
      }
      if (/\[Render\sthread\/INFO\]\s\[minecraft\/Minecraft\]\:\sStopping\!/gm.test(e)) {
        await (3000).sleep()
        blocking_start = false
        win.webContents.send("unblocking", true)
      }
      logger(e)
    });
    launcher.on('data', async (e) => {
      if (/\[Render\sthread\/INFO\]\s\[minecraft\/Minecraft\]\:\sSetting user/gm.test(e)) {
        loading("100%")
        win.minimize()
      }
      if (/\[Render\sthread\/INFO\]\s\[minecraft\/Minecraft\]\:\sStopping\!/gm.test(e)) {
        await (3000).sleep()
        blocking_start = false
        win.webContents.send("unblocking", true)
      }
      logger(e)
    });
  }
  
  function closed() {
    writeFileSync("config.json", JSON.stringify({save_mode, auth, RAM}))
  }

  function createWindow () {
    win = new BrowserWindow({
      width: 620,
      height: 910,
      title: `Mincraft launcher V${version} by Fulldroper`,
      transparent: true, 
      frame: false,
      icon: 'build/icons/256x256.png',
      webPreferences: {
        preload: `${__dirname}/preload.js`
      },
      resizable: false,
      autoHideMenuBar: true,
    })
    
    win.loadFile('index.html')
    // win.setAlwaysOnTop(true, "floating");
  }
  
  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
  // events
  ipcMain.on('play', async () => {
    logger(auth);
    blocking_start || launch({username: auth?.nickname, win, _maxRAM: RAM})
  })
  ipcMain.on("auth", async (_,_auth) => {
    _auth.ip = ip
    let user = (await axios({
      url: "http://auth.fulldroper.cf:1337/auth",
      method: "post",
      data: _auth,
      config: { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json' 
      }}
    })).data
    const { host, port } = (await axios(`${cdn}/${appID}/mods/list.json`)).data
    if (user.err) {
      user = (await axios({
        url: "http://auth.fulldroper.cf:1337/update",
        method: "post",
        data: _auth,
        config: { headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json' 
        }}
      })).data
    }
    if (!user.err) {
      auth = user
      win.webContents.send('authorized', {nickname: user.nickname, RAM, maxRAM, isAdmin: (user.level === 0 ? true : false), host, port });
    }
  })
  ipcMain.on("reg", async (_,reg) => {
    reg.ip = ip;
    const user = (await axios({
      url: "http://auth.fulldroper.cf:1337/reg",
      method: "post",
      data: reg,
      config: { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json' 
      }}
    })).data
    
    //@@@@ add to whitelist
    const r = await Rcon.connect(rcon)
    win.webContents.send('rcon-log', await r.send(`whitelist add ${user.nickname}`));
    win.webContents.send('rcon-log', await r.send(`whitelist reload`));
    r.end()

    if (!user.err) {
      auth = user;
      win.webContents.send("registered", reg.nickname)
    }
  })
  ipcMain.on("loaded", async () => {
    try {
      const saves = JSON.parse((await readFileSync("config.json")).toString())
      RAM = saves.RAM
      save_mode = saves.save_mode
      ///
      const { host } = (await axios(`${cdn}/${appID}/mods/list.json`)).data
      const { port, q} = (await axios(`${cdn}/${appID}/mods/rcon.json`)).data
      rcon = new Rcon({
        host, port, password: q
      })

      
      rcon.on("connect", () => console.log("connected"))
      rcon.on("authenticated", () => console.log("authenticated"))
      rcon.on("end", () => console.log("end"))

      if (save_mode) {
        let user = (await axios({
          url: "http://auth.fulldroper.cf:1337/update",
          method: "post",
          data: {
            ip, token : saves.auth.token, update : saves.auth.update
          },
          config: { headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json' 
          }}
        })).data

        if (user.err) {
          user = (await axios({
          url: "http://auth.fulldroper.cf:1337/update",
          method: "post",
          data:  {
            ip, token : saves.auth.token, update : saves.auth.update
          },
          config: { headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json' 
          }}
          })).data
        }
        
        if (!user.err) {
          auth = user;
          console.log(user);
          win.webContents.send('authorized', {nickname: user.nickname, RAM: (RAM || 1), maxRAM, isAdmin: (user.level === 0 ? true : false)});
        } else {        
          win.webContents.send('RAM', {max: maxRAM, cur: (RAM || 1)});
        }
      } else {
        win.webContents.send('RAM', {max: maxRAM, cur: (RAM || 1)});
      }
    } catch (error) {
      win.webContents.send('RAM', {max: maxRAM, cur: (RAM || 1)});
      console.log(error); 
    }
  })
  ipcMain.on("createNews", async (_, v) => {
    const { token, update }= auth
    let content = v
    v?.img && (content.img_url = v.img)

    console.log((await axios({
      url: "http://auth.fulldroper.cf:1337/news/send",
      method: "post",
      data: {
        token, update, ip, content
      },
      config: { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json' 
      }}
    })).data);
  })
  ipcMain.on("restart-auth", async () => {
    const r = (await axios({
      url: "http://auth.fulldroper.cf:1337/restart",
      method: "post",
      data: { token: auth.token, ip },
      config: { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json' 
      }}
    })).data
    logger("[admin]: auth server restarting")
    if (r?.result) logger("[admin]: auth server restarted")
  })
  ipcMain.on("rcon", async (_, v) => {
    await rcon.connect()
    win.webContents.send('rcon-log', await rcon.send(`${v}`));
    rcon.end()
  })
  ipcMain.on("setRAM", (_,r) => RAM = r)
  ipcMain.on("save_mode", () => save_mode = true )
  ipcMain.on("minimize", () => win.minimize())
  ipcMain.on("get-admin-logs", async () => {
    const r = (await axios({
      url: "http://auth.fulldroper.cf:1337/logs",
      method: "post",
      data: { token: auth.token, ip },
      config: { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json' 
      }}
    })).data
    win.webContents.send('admin-logs', r);
  })
  ipcMain.on("close", () => (closed(), process.exit()))
    
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      closed()
      app.quit()
    }
  })

})();
