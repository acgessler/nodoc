
var DocumentationViewer = (function(undefined) { 
	
return function(settings) {
	settings = settings || {};

	var base_folder = settings.base_folder || '';
	if (base_folder && base_folder[base_folder.length-1] !== '/') {
		base_folder = base_folder + '/';
	}


	var fetch_infoset = (function() {

		var infoset_cache_waiters = {};
		var infoset_cache = {};

		// mini ajax fetcher for infosets with caching
		return function(what, callback) {
			if(infoset_cache[what]) {
				callback(infoset_cache[what]);
			}

			if(infoset_cache_waiters[what]) {
				infoset_cache_waiters[what].push(callback);
				return;
			}

			infoset_cache_waiters[what] = [callback];

			var ajax;
			if (window.XMLHttpRequest) {
		  		ajax = new XMLHttpRequest();
			}
			else {
		  		ajax = new ActiveXObject("Microsoft.XMLHTTP");
			}

			ajax.onreadystatechange = function() {
				if (ajax.readyState === 4) {
					var infoset = null;
					if(ajax.status === 200) {
						infoset = JSON.parse(ajax.responseText);
					}
					var waiters = infoset_cache_waiters[what];
					for (var i = 0; i < waiters.length; ++i) {
						waiters[i](infoset);
					}
				}
			}

			ajax.open("GET", base_folder + what + "?nocache=" + new Date().getTime(),true);
			ajax.send(null);
		};
	}) ();


	var method_full_template = _.template(
		'<div class="method"> ' +
			'<div class="method_info <%= access_spec %>"> </div> ' +
			'<div class="method_info <%= extra_spec %>"> </div> ' +
			'<h3> '+
				'<font size="-1"> ' +
					'<%= access_spec %> ' +
					'<%= extra_spec %>  ' +
					'<%= return_type %> ' +
				'</font> ' +
				'<%= name %>  ' +
				'(<%= parameters %>) '+
			'</h3>  ' +
			'<%= comment %> <hr> '+
		'</div>');

	var class_template = _.template(
		'<h1> ' +
			'<font size="-1">' + 
				'<%= access_prefix %> <%= extra_prefix %> <%= type %> '+
			'</font> '+
			'<%= name %> '+
		'</h1> '+
		'<%= long_desc %>');

	var method_index_entry_template = _.template(
		'<li> '+
			'<a href="#"> '+
				'<%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var ctor_index_entry_template = _.template(
		'<li>'+
			'<a href="#">'+
				'&diam; <%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var method_index_template = _.template('<hr>'+
		'<div class="index">'+
			'<ul>'+
				'<%= index %>'+
			'</ul>'+
		'</div>');


	var set_view = function(left, right) {
		$(".left").html(left);
		$(".right").html(right);

		$(".left, .right").mCustomScrollbar({
			theme: "dark-thick" 
		});
	};


	var page_stack = [];
	var push_view = this.push_view = function(left, right) {

		set_view(left, right);
		page_stack.push([$(".left").clone(true),$(".right").clone(true)]);
	};


	var pop_view = this.pop_view = function() {
		page_stack.pop();
		var elem = page_stack[page_stack.length - 1];
		$(".left") .replaceWith(elem[0]);
		$(".right").replaceWith(elem[1]);
	};


	var open_class = this.open_class = function(file, completion, settings) {
		settings = settings || {};

		var full_view = settings.full_view === undefined ? true : settings.full_view;

		fetch_infoset(file, function(infoset) {
			if (!infoset) {
				if (completion) {
					completion(false);
				}	
				return;
			}
			var text = class_template(infoset);

			var method_index = "";
			var methods = "";
			for (var name in infoset.members) {
				var overloads = infoset.members[name];

				for(var i = 0; i < overloads.length; ++i) {
					var m = overloads[i];
					
					method_index += (name === infoset.name 
						? ctor_index_entry_template 
						: method_index_entry_template )(m);

					methods += method_full_template(m);
				}
			}

			var class_main_page = text + method_index_template({ index : method_index});

			if (full_view) {
				push_view(class_main_page, methods);
			}
			else {
				push_view('', class_main_page);
			}
			
			$('.index li').addClass("dontsplit"); 
			$('.index').columnize({
				columns: 2
			});

			$('pre').addClass("prettyprint lang-java");
			prettyPrint();

			if(completion) {
				completion(true);
			}
		});
	};

	if(!settings.no_search) {
		// generate search box logic
		var index = fetch_infoset('output/index.json', function(index) {
			elems = [];
			for (var k in index) {
				elems.push('<li>'+k+'</li>');
			}

			var e = $('#live_search');
			e.html(elems.join(''));


			$('#searchbox')
				.on('input', function() {
					if(!e.is(":visible")) {
						e.show({
							  duration: 300
							, done: function() {
								e.mCustomScrollbar({
									theme: "dark-thick" 
								});
							}
						});
					}
					return true;
				})
				.liveUpdate( e, function() {

				e.children('li')
					.hover(function() {
						var settings = {
							full_view : false
						};
						open_class('output/class_' + $(this).text() + '.json', function() {}, settings);
					})

					.click(function() {
						e.hide({
							duration: 300
						});
						var settings = {
							full_view : true
						};
						open_class('output/class_' + $(this).text() + '.json', function() {}, settings);
					});
				} );
			;
		});
	}
}; 
})();


function run() {
	var doc = new DocumentationViewer();
	doc.open_class('output/class_Object.json');
}
