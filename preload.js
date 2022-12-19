const { ipcRenderer } = require('electron')
window.onload = async () => {
  const dom = {
    close: document.querySelector("div.close"),
    tray: document.querySelector("div.tray"),
    news: document.querySelector("div.news"),
    admin: document.querySelector("div.admin"),
    play: document.querySelector("div.play"),
    map: document.querySelector("div.map"),
    profile: document.querySelector("div.profile"),
    settings: document.querySelector("div.settings"),
    page: document.querySelector("div.page"),
    page_news: document.querySelector("div.page-news"),
    singin1: document.querySelector("div.login-btns-container > div.singin"),
    login1: document.querySelector("div.login-btns-container > div.login"),
    login2: document.querySelector("div.reg-btns-container > div.login"),
    singin2: document.querySelector("div.reg-btns-container > div.singin"),
    auth_email: document.querySelector("input#auth-email"),
    auth_password: document.querySelector("input#auth-password"),
    auth_remember: document.querySelector("input#auth-remember"),
    map_frame: document.querySelector("iframe#map-frame"),
    reg_email: document.querySelector("input#reg-email"),
    rcon_input: document.querySelector("input#rcon-sender"),
    rcon_input_btn: document.querySelector(".server-rcon > .rcon-send"),
    reg_nickname: document.querySelector("input#reg-nickname"),
    reg_password: document.querySelector("input#reg-password"),
    reg_password2: document.querySelector("input#reg-password2"),
    nickname: document.querySelector(".page-play > .play-container > .nickname"),
    monitoring_text: document.querySelector(".monitoring > .text"),
    monitoring_box: document.querySelector(".monitoring > .graph > .online"),
    monitoring_motd: document.querySelector(".motd"),
    launch: document.querySelector(".page-play > .play-container > .launch"),
    play_ico: document.querySelector(".page-play > .play-container > .launch > .play-ico"),
    loading_ico: document.querySelector(".page-play > .play-container > .launch > .loading-ico"),
    RAM_plus: document.querySelector(".RAM > .plus"),
    RAM_minus: document.querySelector(".RAM > .minus"),
    RAM_counter: document.querySelector(".RAM > .counter"),
    create_news_title: document.querySelector("input#create-title"),
    create_news_description: document.querySelector("textarea#create-description"),
    create_news_image: document.querySelector("input#create-image"),
    create_news_send: document.querySelector("div#create-news"),
    admin_restart_auth: document.querySelector(".admin-restart-auth"),
    admin_logs: document.querySelector(".page-admin > .admin-logs > .logs-container"),
    rcon_info: document.querySelector(".admin-rcon > .sever-logs"),
    rcon_restart: document.querySelector(".page-admin > .btns-container > .admin-restart-server")
  }

  const pages = {}
  let auth
  let isAdmin = false
  let page = auth ? "play" : "auth"
  let nickname = "nickname"
  let maxRAM = 1
  let RAM = maxRAM
  let host = "localhost"
  let port = 25565
  const auth_enter = (e) => {
    if (e.code === "Enter" && page === "auth") {
      dom["login1"].click()
    } else if (e.code === "Enter" && page === "admin") {
      dom["rcon_input_btn"].click()
    }
  }

  const monitoring = async (dom, page, host, port) => {
    if(page !== "play") return;
    const monitoring = await (await fetch(`https://mcapi.us/server/status?ip=${host}:${port}`))?.json() || false
    dom["monitoring_text"].innerText = `Онлайн ${monitoring?.players?.now || 0  }/${monitoring?.players?.max || 0}`
    dom["monitoring_box"].style.width = `${(monitoring?.players?.now / monitoring?.players?.max) * 100}%`
    dom["monitoring_motd"].innerText = monitoring?.motd || "" 
  }
    

  for (const child of dom["page"].childNodes) {
    if (child.nodeName === "DIV") {
      child.classList.add("hide")
      pages[child.dataset.page] = child
    }
  }

  function changePage(pageName) {
    for (const key in pages) {
      pages[key].classList.add("hide");
    }
    pages[pageName].classList.remove("hide")
    page = pageName
  }

  const loadNews = async () => {
    dom["page_news"].innerHTML = "";
    const news_list = await (await fetch("http://auth.fulldroper.cf:1337/news"))?.json() || false
    const keys_ = Object.keys(news_list).reverse()
    keys_.forEach(k => {
      const d = document.createElement("div")
      d.classList.add("news-li")

      const title = document.createElement("div")
      title.classList.add("title")
      title.innerText = k
      d.appendChild(title)

      const desc = document.createElement("div")
      desc.classList.add("body")
      desc.innerText = news_list[k].body
      d.appendChild(desc)

      if (news_list[k]?.img_url) {
        const img = document.createElement("img")
        img.classList.add("img")
        img.src = news_list[k].img_url
        d.appendChild(img)
      }
      
      
      const time = document.createElement("div")
      time.classList.add("time")
      time.innerText = (new Date(Number(news_list[k].time))).toLocaleString("ua")
      d.appendChild(time)


      
      dom["page_news"].appendChild(d)
    })

    if(isAdmin) {
      const create_news = document.createElement("div")
      create_news.classList.add("create")
      create_news.innerText = "Create new"
      create_news.onclick = () => changePage("create-news")
      dom["page_news"].appendChild(create_news)   
    }    
  }

  changePage(page)

  ipcRenderer.on("changePage", (_,page) => changePage(page))
  ipcRenderer.on("RAM", (_, v) => {
    RAM = v.cur;
    maxRAM = v.max
    dom["RAM_counter"].innerText = v.cur;

  })
  ipcRenderer.on("authorized", (_,v) => {
    auth = true;
    nickname = v.nickname;
    maxRAM = v.maxRAM
    RAM = v.RAM
    isAdmin = v.isAdmin
    host = v.host
    port = v.port
    dom["nickname"].innerText = v.nickname;
    dom["RAM_counter"].innerText = v.RAM
    if (v.isAdmin) {
      dom["admin"].classList.remove("hide")
    }
    setInterval(() => monitoring(dom, page, v.host, v.port), 2000)
    changePage("play");
  })
  ipcRenderer.on("registered", (_, v) => {
    nickname = v.nickname
    auth = true
    changePage("play")
  })
  ipcRenderer.on("log", (_,v) => console.log(v))
  ipcRenderer.on("loading", (_, v) => document.documentElement.style.setProperty('--play-loading', v))
  ipcRenderer.on("unblocking", () => {
    dom["play_ico"].classList.remove("hide")
    dom["loading_ico"].classList.add("hide")
  })
  ipcRenderer.on("admin-logs", (_, v) => {
    dom["admin_logs"].innerText = ""
    for (let j = 0; j < v.length; j++) {
      const {premium, level, nickname, email, log} = v[j]

      const _main = document.createElement("details")
      const _main_title = document.createElement("summary")
      const _main_desc = document.createElement("ul")
  
      _main_title.innerText = `[${level === 0 ? "Admin" : "User"}] ${premium ? "*" : ""} ${nickname} - ${email}`
  
      for (let i = 0; i < log.length; i++) {
        const k = Object.keys(log[i])[0]
        const _log = log[i][k].split(":")
        _main_desc.innerHTML += `<li>${(new Date(Number(k))).toLocaleString("ua")} - ${_log[1]} ${_log[0]}</li>`
      }
      
      _main.appendChild(_main_title)
      _main.appendChild(_main_desc)
      dom["admin_logs"].appendChild(_main)
    }
  })
  ipcRenderer.on("rcon-log", (_, v) => {
    const pre = document.createElement("pre")
    pre.innerText = v
    dom["rcon_info"].appendChild(pre)
    dom["rcon_info"].scrollTop = dom["rcon_info"].scrollHeight
  })
  dom["rcon_restart"].onclick = () => {
    ipcRenderer.send("rcon", "stop")
  }
  dom["launch"].onclick = () => {
    ipcRenderer.send("play", true)
    dom["play_ico"].classList.add("hide")
    dom["loading_ico"].classList.remove("hide")
  }
  dom["RAM_minus"].onclick = () => {
    if (RAM - 1  > 0) {
      RAM-=1
      ipcRenderer.send("setRAM", RAM)
      dom["RAM_counter"].innerText = RAM
    }
  }
  dom["RAM_plus"].onclick = () => {
    if (RAM + 1  <= maxRAM) {
      RAM+=1
      ipcRenderer.send("setRAM", RAM)
      dom["RAM_counter"].innerText = RAM
    }
  }
  dom["admin_restart_auth"].onclick = () => {
    if (!isAdmin) return
    ipcRenderer.send("retart-auth", true)
  }
  dom["rcon_input_btn"].onclick = () => {
    ipcRenderer.send("rcon", dom["rcon_input"].value)
  }
  dom["news"].onclick = () => (changePage("news"), loadNews())
  dom["play"].onclick = () => changePage(auth ? "play": "auth")
  dom["profile"].onclick = () => changePage(auth ? "profile": "auth")
  dom["admin"].onclick = () => {
    changePage(auth && isAdmin ? "admin": "auth")
    ipcRenderer.send("get-admin-logs", true)
  };
  dom["login2"].onclick = () => changePage("auth")
  dom["singin1"].onclick = () => changePage("reg")
  document.onkeypress = auth_enter;
  dom["login1"].onclick = () => {
    // auth-email auth-password auth-remember
    if (   
        dom["auth_email"].value &&
        !dom["auth_email"].validity.patternMismatch &&
        dom["auth_password"].value
      ) {
      if (dom["auth_remember"].checked) {
        ipcRenderer.send("save_mode", true)
      }
      ipcRenderer.send("auth", {
        email: dom["auth_email"].value,
        password: dom["auth_password"].value
      })
    }
  }
  dom["singin2"].onclick = () => {
    // auth-email auth-password auth-remember
    if (   
        dom["reg_email"].value &&
        !dom["reg_email"].validity.patternMismatch &&
        dom["reg_nickname"].value &&
        dom["reg_password"].value &&
        dom["reg_password2"].value &&
        dom["reg_password"].value === dom["reg_password2"].value
      ) {
      ipcRenderer.send("reg", {
        email: dom["reg_email"].value,
        password: dom["reg_password"].value,
        nickname: dom["reg_nickname"].value
      })
    }
  }
  dom["create_news_send"].onclick = () => {
    if (!auth || !isAdmin || !dom['create_news_title'].value || !dom["create_news_description"].value) return;
    ipcRenderer.send("createNews", {
      title: dom['create_news_title'].value,
      body: dom["create_news_description"].value,
      img: dom["create_news_image"].value
    })
    loadNews()
    changePage("news")
  }
  dom["settings"].onclick = () => changePage("settings")
  dom["map"].onclick = () => (changePage(auth ? "map" : "auth"), dom['map_frame'].style.width = "100%")
  dom["close"].onclick = () => ipcRenderer.send("close", true)
  dom["tray"].onclick = () => ipcRenderer.send("minimize", true)

  ipcRenderer.send("loaded", true)
}