// icon http://www.flaticon.com/free-icon/japan-food_13200
jQuery.fn.exists = function(){return Boolean(this.length > 0);};
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

(function(global, $, undefined) {
  var console = global.console;
  var localStorage = global.localStorage;
  var JSON = global.JSON;
  var location = global.location;
  var parseInt = global.parseInt;
  var setInterval = global.setInterval;
  var clearInterval = global.clearInterval;

  var CACHE_MAX_AGE = 3600; // seconds
  var API = 'http://api.b.st-hatena.com/entry.count?url=';
  var IMAGE_API = 'http://b.hatena.ne.jp/entry/image/';
  var KEY_PREFIX = 'ACH:';

  // 現在の秒数
  function now_seconds(){
    return new Date().getTime() / 1000
  }

  // localStorageからの取得とJSON.parse
  function fetch_cache(key){
    if(key.startsWith(KEY_PREFIX)) throw 'KEY_PREFIX付きのままlocalStorageにアクセスしている: ' + key;
    var json_str = localStorage.getItem(KEY_PREFIX + key);
    return JSON.parse(json_str ? json_str : '{}');
  }

  // JSON.stringifyとlocalStorageへの保存
  function set_cache(key, obj){
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(obj));
  }

  // 全てのキャッシュを削除
  function clear_cache(){
    Object.keys(localStorage).forEach(function(key){
      if(key.startsWith('http') || key.startsWith('advent_calendar_hatebu:') || key.startsWith(KEY_PREFIX)){
        localStorage.removeItem(key);
      }
    });
    console.log('cache cleared');
  }

  // 期限切れキャッシュの削除
  function clear_cache_if_expired(){
    Object.keys(localStorage).forEach(function(key){
      if(key.startsWith('http') || key.startsWith('advent_calendar_hatebu:')){
        localStorage.removeItem(key);
        return;
      }

      if(!key.startsWith(KEY_PREFIX)) return;
      var cache = fetch_cache(key.split(KEY_PREFIX)[1]);
      if(!cache || !cache['created_at'] || cache['created_at'] < now_seconds() - CACHE_MAX_AGE){
        localStorage.removeItem(key); console.log('expired', key);
      }
    });
  }

  // はてぶ画像っぽいspanを作る
  function hatebu_dummy_image(num, font_size){
    var font_size = font_size ? font_size : 11;
    var padding_size = Math.round(font_size / 5);
    if(padding_size > 3) padding_size = 3;
    return $('<span class="hatebu-dummy-image" style="color: #FF6664; background-color: #FFEFEF;" />')
        .text(num + ' users')
        .css('font-size', font_size + 'px')
        .css('padding', padding_size + 'px')
  }

  // はてぶ画像っぽいspanに半角空白を付ける
  function hatebu_dummy_image_wrapper(num, font_size){
    return $('<span class="hatebu-dummy-image-wrapper" />')
        .append('&nbsp;')
        .append(hatebu_dummy_image(num, font_size));
  }

  var Calendar = function (td_selector, context) {
    this.tds = $(td_selector, context);
  };

  Calendar.prototype.update = function (callback_fn) {
    var me = this;

    if (typeof callback_fn == 'function') {
      me.draw_callback = callback_fn;
    }

    this.tds.each(function(){
      var td = $(this);
      var author = td.find('p.adventCalendar_calendar_author a');
      var blog = td.find('p.adventCalendar_calendar_entry a').attr('href');
      if(blog === undefined || blog == ''){
        return true
      }

      if(blog.startsWith('/')){
        blog = 'http://qiita.com' + blog;
      }

      me.update_each(blog, author);
    });
  };

  Calendar.prototype.update_each = function (blog, context) {
    var me = this;
    var cache = fetch_cache(blog);
    if(cache && cache['created_at'] > now_seconds() - CACHE_MAX_AGE){
      me.draw(context, cache);
    }else{
      $.get(API + encodeURIComponent(blog), function(res){
        var count = res == '' ? 0 : parseInt(res);
        var image = IMAGE_API + blog;
        var cache = {
          count: count,
          image: image,
          blog: blog,
          calendar: global.location.href,
          created_at: now_seconds()
        };
        set_cache(blog, cache);
        me.draw(context, cache);
      });
    }
  };

  Calendar.prototype.draw = function (context, cache) {
    this.add_count_beside_name(context, cache);
    this.add_all_count_in_caption();

    if (typeof this.draw_callback == 'function') {
      this.draw_callback();
    }
  };

  // カレンダーの各ユーザー名の横にはてぶ数を追加
  Calendar.prototype.add_count_beside_name = function (context, cache) {
    context
        .attr('title', 'hateb: ' + cache['count'])
        .append('&nbsp;');

    if(cache['count'] == 0){
      context
          .append(hatebu_dummy_image(0));
    }else{
      context
          .append($('<img />').attr('src', cache['image']));
    }
  };

  // 現在のカレンダーのはてぶ数合計をtableタグのcaptionに追加
  Calendar.prototype.add_all_count_in_caption = function () {
    var sum = 0;
    Object.keys(localStorage).forEach(function(key){
      if(!key.startsWith(KEY_PREFIX)) return;
      var cache = fetch_cache(key.split(KEY_PREFIX)[1]);
      if(!cache || !cache['count'] || location.href != cache['calendar']) return;
      sum += cache['count'] ? parseInt(cache['count']) : 0;
    });
    $('table.adventCalendar_calendar_table.table')
        .find('caption')
        .remove()
        .end()
        .prepend($('<caption style="text-align: left;" />').html(hatebu_dummy_image(sum, 28)));
  };

  var CalendarList = function (td_selector, each_cal_td_selector) {
    this.tds = $(td_selector);
    this.each_cal_td_selector = each_cal_td_selector;
  };

  CalendarList.prototype.update = function () {
    var me = this;
    this.tds.each(function(){
      var td = $(this);
      var a = td.find('a:last-child');
      var calendar = 'http://qiita.com' + a.attr('href');

      a.on('click', function(){
        var timer_id = null, loop_num = 0;
        function stop_timer() {
          clearInterval(timer_id);
        }
        (function () {
          timer_id = setInterval(function () {
            me.update_each(calendar, td);
            loop_num++;
            if(loop_num > 5) stop_timer();
          }, 1000);
        })();
      });
      me.update_each(calendar, td);
    });
  };

  CalendarList.prototype.update_each = function (calendar, context) {
    var me = this;
    var cache = fetch_cache(calendar);
    if(cache && cache['created_at'] > now_seconds() - CACHE_MAX_AGE){
      ;
    }else{
      var sum = 0;
      Object.keys(localStorage).forEach(function(key){
        if(!key.startsWith(KEY_PREFIX)) return;
        var cache = fetch_cache(key.split(KEY_PREFIX)[1]);
        if(!cache || !cache['calendar'] || cache['calendar'] != calendar) return;
        sum += cache['count'] ? parseInt(cache['count']) : 0;
      });

      if(sum != 0){
        cache = {
          count: sum,
          image: IMAGE_API + calendar,
          created_at: now_seconds()
        };
        set_cache(calendar, cache);
      }else{
        cache = null;
        //$.get(calendar, function(res){
        //  new Calendar(me.each_cal_td_selector, res).update(function(){
        //    me.update_each(calendar, context);
        //  });
        //});
      }
    }
    me.draw(context, cache);
  };

  // カレンダー一覧ページを更新
  CalendarList.prototype.draw = function (context, cache) {
    context
        .find('.please-open')
        .remove()
        .end()
        .find('.hatebu-dummy-image-wrapper')
        .remove();

    if(!cache || !cache['count'] || cache['count'] == 0){
      context
          .append($('<span class="please-open" style="font-size: 12px; color: #bbbbbb;" />').text(' カレンダーを1度開いてください'));
    }else{
      context
          .append(hatebu_dummy_image_wrapper(cache['count'], 16));
    }
  };

  // エントリーポイント
  $('body').on('keypress', function(e){
    if(e.which == 108 && window.confirm('Advent Calendar Hatebuのキャッシュを削除しますか？')){ // 108 == l key
      clear_cache();
    }
  });

  var each_cal = 'table.adventCalendar_calendar_table.table td.adventCalendar_calendar_day';

  if($('table.adventCalendar_calendar_table.table').exists()){
    clear_cache_if_expired();
    new Calendar(each_cal, document.body).update();
  }else{
    var cal_list = 'div.adventCalendar_calendarList td.adventCalendar_labelContainer.adventCalendar_calendarList_calendarTitle';
    new CalendarList(cal_list, each_cal).update();
  }
})(window, jQuery);