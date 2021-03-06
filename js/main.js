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
  var OLD_KEY_PREFIX = [
    'advent_calendar_hatebu:',
    'ACH:'
  ];
  var KEY_PREFIX = 'ACH2:';

  // 現在の秒数
  function now_seconds(){
    return new Date().getTime() / 1000
  }

  function is_expired(created_at){
    if(!created_at || isNaN(created_at)) return true;
    return created_at < now_seconds() - CACHE_MAX_AGE
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
      if(key.startsWith('http') || key.startsWith(OLD_KEY_PREFIX[0]) ||
          key.startsWith(OLD_KEY_PREFIX[1]) || key.startsWith(KEY_PREFIX)){
        localStorage.removeItem(key);
      }
    });
    console.log('cache cleared');
  }

  // 期限切れキャッシュの削除。カレンダーURLが指定されている場合は当該カレンダーのキャッシュのみ削除
  function clear_cache_if_expired(calendar){
    Object.keys(localStorage).forEach(function(key){
      if(key.startsWith('http') || key.startsWith(OLD_KEY_PREFIX[0] ||
          key.startsWith(OLD_KEY_PREFIX[1]))){
        localStorage.removeItem(key);
        return;
      }

      if(!key.startsWith(KEY_PREFIX)) return;
      var cache = fetch_cache(key.split(KEY_PREFIX)[1]);
      if(!cache || !cache['created_at'] || is_expired(cache['created_at'])){
        if(!calendar || (cache['calendar'] == calendar)){
          localStorage.removeItem(key); console.log('expired', key);
        }
      }
    });
  }

  // はてぶ画像っぽいspanを作る
  function hatebu_dummy_image(num, font_size){
    var font_size = font_size ? font_size : 11;
    var padding_size = Math.round(font_size / 5);
    if(padding_size > 3) padding_size = 3;

    if(!global.hatebu_dummy_image_cache){
      global.hatebu_dummy_image_cache = {};
    }

    var key = num + '-' + font_size;
    if(!global.hatebu_dummy_image_cache[key]){
      global.hatebu_dummy_image_cache[key] =
          $('<span class="hatebu-dummy-image" style="color: #FF6664; background-color: #FFEFEF;" />')
              .text(num + ' users')
              .attr('data-count', num)
              .css('font-size', font_size + 'px')
              .css('padding', padding_size + 'px');
    }
    return global.hatebu_dummy_image_cache[key].clone(false)
  }

  // はてぶ画像っぽいspanに半角空白を付ける
  function hatebu_dummy_image_wrapper(num, font_size){
    var font_size = font_size ? font_size : 11;

    if(!global.hatebu_dummy_image_wrapper_cache){
      global.hatebu_dummy_image_wrapper_cache = {};
    }

    var key = num + '-' + font_size;
    if(!global.hatebu_dummy_image_wrapper_cache[key]){
      global.hatebu_dummy_image_wrapper_cache[key] =
          $('<span class="hatebu-dummy-image-wrapper" />')
              .append('&nbsp;')
              .append(hatebu_dummy_image(num, font_size));
    }
    return global.hatebu_dummy_image_wrapper_cache[key].clone(false)
  }

  // 各カレンダーページを更新するためのクラス
  var Calendar = function (td_selector, options) {
    this.finished = {};

    if(options){
      this.tds = $(options['html']).find(td_selector);
      this.url = options['url'];
      this.need_draw = false;
    }else{
      this.tds = $(td_selector);
      this.url = location.href;
      this.need_draw = true;
    }

    this.loop_num = this.tds.length;
    this.fetch_all_cache();
  };

  Calendar.prototype.fetch_all_cache = function () {
    var cache = fetch_cache(this.url);
    if(!cache || !cache['blogs'] || !cache['created_at'] ||
        is_expired(cache['created_at']) || Object.keys(cache['blogs']).length == 0){
      this.blogs = {};
    }else{
      this.blogs = cache['blogs'];
    }
  };

  // 更新処理を開始する時に外から呼ばれるメソッド
  Calendar.prototype.update = function (callback_fn) {
    var me = this;

    if (typeof callback_fn == 'function') {
      me.draw_callback = callback_fn;
    }

    this.tds.each(function(i){
      var td = $(this);
      var author = td.find('p.adventCalendar_calendar_author a');
      var blog = td.find('p.adventCalendar_calendar_entry a').attr('href');
      if(blog === undefined || blog == ''){
        me.finished[i] = true;
        return true
      }

      if(blog.startsWith('/')){
        blog = 'http://qiita.com' + blog;
      }

      me.update_each(blog, author, i);
    });
  };

  // 各作者ごと(=日付ごと)の更新処理を行う
  Calendar.prototype.update_each = function (blog, context, i) {
    var me = this;
    var cache = me.blogs[i];
    if(cache && !is_expired(cache['created_at'])){
      me.draw(context, cache);
    }else{
      me.blogs[i] = null;

      $.get(API + encodeURIComponent(blog), function(res){
        var count = res == '' ? 0 : parseInt(res);
        var image = IMAGE_API + blog;
        var cache = {
          count: count,
          image: image,
          blog: blog,
          calendar: me.url,
          created_at: now_seconds()
        };

        me.blogs[i] = cache;
        me.finished[i] = true;

        if(me.all_finished()){
          me.set_all_cache();
        }

        me.draw(context, cache);
      });
    }
  };

  Calendar.prototype.all_finished = function () {
    var finished = true;
    for(var i = 0; i < this.loop_num; i++){
      if(!this.finished[i]){
        finished = false;
        break;
      }
    }

    return finished;
  };

  Calendar.prototype.set_all_cache = function () {
    var data = {
      blogs: this.blogs,
      length: this.loop_num,
      created_at: now_seconds()
    };
    set_cache(this.url, data);
  };

  // DOMを更新する。1ページを更新する際、経過日数分呼ばれることになる
  Calendar.prototype.draw = function (context, cache) {
    if(this.need_draw){
      this.add_count_beside_name(context, cache);
      this.add_all_count_in_caption();
    }

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

  // 現在のカレンダーのはてぶ数合計を集計する
  Calendar.prototype.sum_hatebu = function () {
    var sum = 0;
    for(var i = 0; i < this.loop_num; i++){
      var cache = this.blogs[i];
      if(!cache || !cache['count'])
        continue;
      sum += cache['count'] ? parseInt(cache['count']) : 0;
    }

    return sum;
  };

  // 現在のカレンダーのはてぶ数合計をtableタグのcaptionに追加
  Calendar.prototype.add_all_count_in_caption = function () {
    $('table.adventCalendar_calendar_table.table')
        .find('caption')
        .remove()
        .end()
        .prepend($('<caption style="text-align: left;" />').html(hatebu_dummy_image(this.sum_hatebu(), 28)));
  };

  // カレンダー一覧ページを更新するためのクラス
  // このクラスでは、基本的には、キャッシュがあったら使う、という動作しかしない
  var CalendarList = function (td_selector, each_cal_td_selector) {
    this.tds = $(td_selector);
    this.each_cal_td_selector = each_cal_td_selector;
    //this.show_update_btn = false;
    this.init();
  };

  // ページ上部のボタンを追加。コンストラクタから一度だけ呼ばれる
  CalendarList.prototype.init = function () {
    var me = this;

    var refresh_btn = $('<button class="btn btn-info" style="font-size: 12px;" />')
        .addClass('update-all-calendar-btn')
        .text(' 全ての未集計カレンダーのはてぶ数を更新')
        .prepend('<i class="fa fa-refresh" />')
        .on('click', function(){
          if(window.confirm('更新を開始してもよろしいですか？')){
            $('.update-each-calendar-btn').each(function(i){
              var btn = $(this);
              // 負荷を抑えるためのdelay
              setTimeout(function() {
                btn.trigger('click');
              } , 100 * i);
            });
          }
        });

    $('h3').append('&nbsp;').append(refresh_btn).append('&nbsp;');
    $('.update-all-calendar-btn').first()
        .attr('data-intro', 'このページの全てのカレンダーの はてブ数 を一括更新します。')
        .attr('data-step', '1');

    var sort_btn = $('<button class="btn btn-default" style="font-size: 12px;" />')
        .addClass('sort-all-calendar-btn')
        .text(' はてぶ数の降順でソート')
        .prepend('<i class="fa fa-sort" />')
        .on('click', function(){
          me.tds.sortElements(function(a, b){
            var a_count = $(a).find('.hatebu-dummy-image').data('count');
            var b_count = $(b).find('.hatebu-dummy-image').data('count');
            if(!a_count) a_count = 0;
            if(!b_count) b_count = 0;

            // DESC
            return a_count < b_count ? 1 : -1;
          });
        });

    $('h3').append(sort_btn).append('&nbsp;');
    $('.sort-all-calendar-btn').first()
        .attr('data-intro', '各カレンダーを はてブ数 の降順でソートします。')
        .attr('data-step', '2');

    var remove_btn = $('<button class="btn btn-danger" style="font-size: 12px;" />')
        .addClass('remove-all-cache-btn')
        .text(' はてぶ数のキャッシュを削除')
        .prepend('<i class="fa fa-times" />')
        .on('click', function(){
          if(window.confirm('Advent Calendar Hatebu のキャッシュを削除しますか？')){
            clear_cache();
            me.update();
          }
        });

    $('h3').append(remove_btn).append('&nbsp;');
    $('.remove-all-cache-btn').first()
        .attr('data-intro', 'このプラグインが持つ はてブ数 のキャッシュを全て削除します。')
        .attr('data-step', '3');

    //var checkbox = $('<label style="font-size: 12px;" />')
    //    .append('<input type="checkbox" />')
    //    .append(' 全てのカレンダーに更新ボタンを表示')
    //    .on('change', function(){
    //      me.show_update_btn = $(this).find('input').prop('checked');
    //      if(me.show_update_btn){
    //        $('has-value').$('.update-each-calendar-btn').show();
    //      }else{
    //        $('has-value').$('.update-each-calendar-btn').hide();
    //      }
    //    });
    //var checkbox_wrapper = $('<span class="label label-default checkbox" />')
    //    .append(checkbox);
    //
    //$('h3')
    //    .append('&nbsp;')
    //    .append(checkbox_wrapper);

    me.tds.first()
        .attr('data-intro', '各カレンダーごとに はてブ数 を更新します。')
        .attr('data-step', '4');
  };

  // 更新処理を開始する時に外から呼ばれるメソッド
  CalendarList.prototype.update = function () {
    var me = this;
    this.tds.each(function(){
      var td = $(this);
      var a = td.children('a:last');
      var calendar = 'http://qiita.com' + a.attr('href');

      // 各カレンダーへのリンクに、別タブで開いたらはてぶ数を更新するイベントを設定しておく
      a.off('.ADH').on('click.ADH', function(){
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

  // 各カレンダーごとの更新処理を行う
  CalendarList.prototype.update_each = function (calendar, context) {
    var me = this;
    var cache = fetch_cache(calendar);
    var sum = 0;

    if(cache && !is_expired(cache['created_at'])){
      var blogs = cache['blogs'];
      var length = cache['length'];

      for(var i = 0; i < length; i++){
        var blog = blogs[i];
        if(!blog || !blog['count'])
         continue;
        sum += blog['count'];
      }
    }else{
      cache = null;
    }
    me.draw(calendar, context, cache, sum);
  };

  // カレンダー一覧ページを更新
  // 各カレンダーごとに、はてブ数と更新ボタンを追加する
  CalendarList.prototype.draw = function (calendar, context, cache, sum) {
    var me = this;
    var update_btn_class = 'please-open';

    context
        .find('.' + update_btn_class)
        .remove()
        .end()
        .find('.hatebu-dummy-image-wrapper')
        .remove();

    if(!me._each_update_btn_cache){
      me._each_update_btn_cache = $('<button class="btn btn-sm btn-default" style="font-size: 12px;" />')
          .addClass('update-each-calendar-btn')
          .text(' はてぶ数を更新')
          .prepend('<i class="fa fa-refresh" />');
    }
    var _btn = me._each_update_btn_cache.clone(false)
        .attr('data-url', calendar); // デバッグ用

        _btn.on('click', function(){
          $.get(calendar, function(res){
            new Calendar(me.each_cal_td_selector, {url: calendar, html: res}).update(function(){
              me.update_each(calendar, context);
            });
          });
        });

    //me.show_update_btn ? _btn.show() : _btn.hide();
    var update_btn = $('<span />')
        .addClass(update_btn_class)
        .append('&nbsp;')
        .append(_btn);

    if(!cache){
      // 集計していない
      context.append(update_btn);
    }else if(sum == 0){
      // 集計されたが0だった
      update_btn.prepend(hatebu_dummy_image_wrapper(0, 16));
      context.append(update_btn);
    }else{
      // 集計済みの数値を持つ
      context.append(hatebu_dummy_image_wrapper(sum, 16));
    }
  };

  // エントリーポイント
  var each_cal = 'table.adventCalendar_calendar_table.table td.adventCalendar_calendar_day';

  if($('table.adventCalendar_calendar_table.table').exists()){
    clear_cache_if_expired(location.href);
    new Calendar(each_cal).update();
  }else{
    var cal_list = 'div.adventCalendar_calendarList td.adventCalendar_labelContainer.adventCalendar_calendarList_calendarTitle';
    new CalendarList(cal_list, each_cal).update();

    if(!localStorage.getItem(KEY_PREFIX + 'intro')){
      introJs().start();
      localStorage.setItem(KEY_PREFIX + 'intro', true);
    }
  }
})(window, jQuery);