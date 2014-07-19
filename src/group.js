var noop = function(){};
var remove = function(i) { i.remove(); };
var ident = function(i){ return i; }
var fluentAccessor = function(thing, state, property){
  thing[property] = function(value){
    if (value === void 0) { return state[property]; }
    state[property] = value;
    return thing;
    }
  };

function basicState(){
  return { transform: ident, id: function(d, i) { return i; }
           , enter: noop , update: noop , exit: remove
          }
  }

var handler = function(select) {
  var state = basicState();
  state.container = '';
  function handler(selection) {
    var rebind;
    selection.each(function(data){
      var self = this;
      data = state.transform(data);
      if (state.container) {
        var cont = d3.select(self).selectAll(state.container).data([data]);
        contDesc = parseSelection(state.container);
        var container = cont.enter().append(contDesc[0]);
        if (contDesc[1]) { container.attr('id', contDesc[1]); }
        if (contDesc[2].length) { container.attr('class', contDesc[2].join(' ')); }
        rebind = function() { return cont.selectAll(select).data(ident, state.id); };
      } else {
        rebind = function () { return d3.select(self).selectAll(select).data(data, state.id); }
      }
      var bound = rebind();
      state.exit.call(state, bound.exit());
      state.enter.call(state, bound.enter());
      state.update.call(state, rebind());
      });
    }
  Object.keys(state).forEach(function(key){ fluentAccessor(handler, state, key); });
  return handler;
  }

function parseSelection(select) {
  var segments = select.split(/[\.#]/)
    , ele = segments.shift()
    , id, match;
  if (match = select.match(/#([-\w]+)/)) { id = match[1]; }
  var classes = segments.filter(function(s){ return select.match('\\.'+s); })
  return [ele, id, classes];
}

var reference = function(name){
  var state = {
    enter: noop
    , update: noop
    , axis: d3.svg.axis()
    , scale: d3.scale.linear()
    , left: 0
    , top: 0
    };

  var group = handler('g.'+name)
    .transform(function(d){ return [d]; })
    .enter(function(parent){
      var g = parent.append('g').attr('class', name);
      state.enter.call(state, g);
      })
    .update(function(g){
      state.axis.scale(state.scale);
      g.call(state.axis)
       .attr('translate', 'transform(' + state.left +','+ state.top +')')
      state.update.call(state, g);
      });

  Object.keys(state).forEach(function(key){ fluentAccessor(group, state, key); });
  return group;
  }

var menu = function(name){
  var state = {options:[], callbacks:[], selected: null}

  var optionHandler = handler('option')
    .id(function(opt){ return opt.value; })
    .enter(function(sel){ sel.append('option').attr('value', this.id); })
    .update(function(options){ options.text(function(opt){ return opt.text; }); });

  var menu = handler('select.'+name)
    .transform(function(d){ return [d]; })
    .enter(function(p){
      var select = p.append('select').attr('class', name).attr('name',name);
      select.on('change', function(){
        var value = this.value;
        state.selected = state.options.filter(function(opt){ return opt.value === value; })[0];
        state.callbacks.forEach(function(cb){ cb.call(state, state.selected); });
        })
      })
    .update(function(select){
      select.datum(state.options);
      optionHandler(select);
      })

  menu.selected = function(){ return state.selected }
  menu.option = function(name, config){
    if (!config) { config = {} }
    config.value = name
    if (!config.text) { config.text = name }
    state.options.push(config)
    if (! state.selected) { state.selected = config }
    return menu
    }
  menu.change = function(fn) { state.callbacks.push(fn); return menu }
  return menu
  }

var slider = function(name){
  var callbacks = [];
  var state = {
    value: 0
    , disabled: false
    , fill: '#ddd'
    , width: 100
    , height: 20
    , enter: noop
    , update: noop
    }

  var slider = handler('div.'+name)
    .transform(function(d){ return [state.value] })
    .enter(function(parent){
      div = parent.append('div').attr('class', name)
      svg = div.append('svg:svg')
      svg.append('svg:rect').attr('x',0).attr('y',0)
      svg.call(d3.behavior.drag().on('drag', function(){
        if (state.disabled) { return; }
        var x = d3.mouse(this)[0];
        state.value = Math.max(0, Math.min(state.width, x)) / state.width;
        callbacks.forEach(function(cb){ cb(state.value); })
        }))
      state.enter(div)
      })
    .update(function(div){
      div.classed({disabled:state.disabled});
      div.selectAll('svg')
        .attr('width', state.width)
        .attr('height', state.height);
      div.selectAll('rect')
        .attr('width', state.value * state.width)
        .attr('height', state.height)
        .attr('fill', state.fill);
      state.update(div)
      })
  Object.keys(state).forEach(function(prop){ fluentAccessor(slider, state, prop); });

  slider.change = function(cb) { callbacks.push(cb); return slider }
  return slider
  }

function toggleable(name, select) {
  var callbacks = []
    , state = {text: name, active: false, enter: noop, update: noop};
  state.fire = function(){
    state.active = ! state.active;
    callbacks.forEach(function(cb){ cb.call(state, btn); });
    }
  var btn = handler(select)
    .transform(function(d){ return [d]; })
    .enter(function(sel){ state.enter.call(state, sel); })
    .update(function(sel){ state.update.call(state, sel); });
  btn.toggle = function() { state.active = !state.active; return btn; };
  Object.keys(state).forEach(function(key){ fluentAccessor(btn, state, key); });
  delete btn.fire;

  btn.click = function(callback) {
    if (_.isFunction(callback)) { callbacks.push(callback) }
    return btn
    }
  return btn;
  }

var toggle = function(name) {
  return toggleable(name, 'div.switch.'+name)
    .enter(function(parent){
      var container = parent.append('div').attr('class', 'switch '+name).on('click', this.fire);
      var label = container.append('div').attr('class', 'label-switch');
      label.append('input').attr('type', 'checkbox');
      label.append('div').attr('class', 'checkbox');
      container.append('span');
      })
    .update(function(container){
      container.selectAll('input').property('checked', this.active);
      container.selectAll('span').text(this.text);
      })
  }

