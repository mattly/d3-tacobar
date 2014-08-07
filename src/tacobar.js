(function(context){

  var noop = function(){};
  var remove = function(i) { i.remove(); };
  var ident = function(i){ return i; }
  var fluentAccessor = function(thing, state, property){
    thing[property] = function(value){
      if (arguments.length === 0) { return state[property]; }
      state[property] = value;
      return thing; }
    };

  function parseSelection(select) {
    var segments = select.split(/[\.#]/)
      , ele = segments.shift()
      , id, match;
    if (match = select.match(/#([-\w]+)/)) { id = match[1]; }
    var classes = segments.filter(function(s){ return select.match('\\.'+s); })
    return [ele, id, classes]; }

  var bar = {};
  var handler = bar.handler = function(select) {
    var state = { transform: ident, id: function(d, i) { return i; }
                , enter: noop , update: noop , exit: remove };
    state.container = '';
    function handler(selection) {
      selection.each(function(data){
        var base, sel;
        data = state.transform(data);
        if (state.container) {
          var base = d3.select(this).selectAll(state.container).data([data])
            , containerDesc = parseSelection(state.container)
            , container = base.enter().append(containerDesc[0]);
          if (containerDesc[1]) { container.attr('id', containerDesc[1]); }
          if (containerDesc[2].length) { container.attr('class', containerDesc[2].join(' ')); }
          sel = base.selectAll(select).data(ident, state.id);
        } else {
          base = d3.select(this);
          sel = base.selectAll(select).data(data, state.id);
        }
        state.exit.call(state, sel.exit());
        state.enter.call(state, sel.enter());
        state.update.call(state, base.selectAll(select));
        });
      }
    Object.keys(state).forEach(function(key){ fluentAccessor(handler, state, key); });
    return handler; }

  var reference = bar.reference = function(name){
    var state = {
      enter: noop
      , update: noop
      , axis: d3.svg.axis()
      , scale: d3.scale.linear()
      , transition: null
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
        if (state.transition) {
          g = g.transition();
          state.transition.call(state, g);
        }
        g.call(state.axis)
        .attr('translate', 'transform(' + state.left +','+ state.top +')')
        state.update.call(state, g);
        });

    Object.keys(state).forEach(function(key){ fluentAccessor(group, state, key); });
    return group; }

  var menu = bar.menu = function(name){
    var callbacks=[];
    var state = {transform: ident, text: ident, value: ident}

    var optionHandler = handler('option')
      .enter(function(sel){ sel.append('option'); })
      .update(function(options){ options.text(state.text).attr('value', state.value); });

    var menu = handler('select.'+name)
      .transform(function(d){ return [state.transform(d)]; })
      .enter(function(p){
        var select = p.append('select').attr('class', name).attr('name',name);
        select.on('change', function(){
          var value = this.value
            , data = d3.select(this).datum()
            , selected = data.filter(function(opt){ return state.value(opt) === value; })[0];
          callbacks.forEach(function(cb){ cb.call(this, selected); });
          })
        })
      .update(function(select){
        select.call(optionHandler);
        });

    ['text','value','transform'].forEach(function(key){ fluentAccessor(menu, state, key); });
    menu.change = function(fn) { callbacks.push(fn); return menu }
    return menu; }

  var slider = bar.slider = function(name){
    var callbacks = [];
    var state = {
      value: ident
      , disabled: false
      , fill: '#ddd'
      , width: 100
      , height: 20
      , enter: noop
      , update: noop
      }

    var isDisabled = function() {
      if (typeof state.disabled === 'function'){ return state.disabled(); }
      return state.disabled; }
    var slider = handler('div.'+name)
      .transform(function(d){ return [state.value(d)]; })
      .enter(function(parent){
        div = parent.append('div').attr('class', name)
        svg = div.append('svg:svg')
        svg.append('svg:rect').attr('x',0).attr('y',0)
        svg.call(d3.behavior.drag().on('drag', function(){
          if (isDisabled()) { return; }
          var x = d3.mouse(this)[0];
          var value = Math.max(0, Math.min(state.width, x)) / state.width;
          callbacks.forEach(function(cb){ cb.call(this, value); });
          }))
        state.enter(div);
        })
      .update(function(div){
        div.classed({disabled: isDisabled()});
        div.selectAll('svg')
          .attr('width', state.width)
          .attr('height', state.height);
        div.selectAll('rect').datum(div.datum())
          .attr('width', function(d){ return d * state.width; })
          .attr('height', state.height)
          .attr('fill', state.fill);
        state.update(div)
        })
    Object.keys(state).forEach(function(prop){ fluentAccessor(slider, state, prop); });
    delete slider.transform;

    slider.change = function(cb) { callbacks.push(cb); return slider }
    return slider }

  function toggleable(name, select) {
    var callbacks = []
      , state = {text: name, active: false, enter: noop, update: noop};
    state.fire = function(){
      state.active = ! state.active;
      callbacks.forEach(function(cb){ cb.call(btn, state.active); });
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
    return btn; }

  var toggle = bar.toggle = function(name) {
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

  var button = bar.button = function(name){
    var state = {}
      , btn = toggleable(name, 'button.button.'+name)
      .enter(function(parent){ parent.append('button').attr('class', 'button '+name).on('click', this.fire); })
      .update(function(button){
        var bg = d3.rgb(state.color).darker(this.active ? 1 : 0)
        button.text(this.text).classed({active: this.active}).style({'background-color': bg});
        })
    fluentAccessor(btn, state, 'color');
    return btn; }

  if (typeof this === 'object' && typeof module === 'object') { module.exports = bar; }
  else if (typeof define === 'function' && define.amd) { define(bar); }
  else { this.tacobar = bar; }
}).call(this);
