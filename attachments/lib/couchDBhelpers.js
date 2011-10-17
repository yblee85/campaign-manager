function db(name){return $.couch.db(name);};

function view(designDoc,name){return designDoc + "/" + name;};

function query(options, view, database){
    return function(callback){
	var mergedOptions = $.extend({success: callback},options);
	database.view(view, mergedOptions);
    };
};

function basicQuery(view,database){
    return query({},view,database);
};

function groupQuery(view,database,group_level){
    return query({group_level:group_level},view,database);
};