const Carder = (() => {
  const Carder = function (config) {
    let c = this
    config = config || {}
    this.container = $('<div class="carder">')
    let containerBrowserWrap = $('<div class="carder-browser-wrap">')
    this.pageContainer = $('#'+(config.container || this.containerID))
      .addClass("carder-page")
      .append (containerBrowserWrap
               .append (this.container,
                        $('<div class="carder-browser-navbar-pad">')))
  }

  $.extend (Carder.prototype, {
    containerID: 'carder'
  })

  return Carder
})()
