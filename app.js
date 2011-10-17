 var couchapp = require('couchapp')
  , path = require('path')
  ;

ddoc = 
  { _id:'_design/app'
  , rewrites : 
    [ {from:"/", to:'index.html'}
    , {from:"/api", to:'../../'}
    , {from:"/api/*", to:'../../*'}
    , {from:"/*", to:'*'}
    ]
  }
  ;



ddoc.filters = {};

ddoc.views = {};
ddoc.views.byEndDate={
    map:function(doc){
	const campaignEndDate = new Date(doc.time.end);
	Date.prototype.toArray = function(){return [this.getFullYear(),(this.getMonth()+1),this.getDate()];};
	emit(campaignEndDate.toArray(),doc);
    }
};
ddoc.views.dates={
    map:function(doc) {
	/* list campaigns bye day they are playing [yyyy,mm,dd]
	 * each campaign will most likely run for multiple days
	 * output each day.
	 * 
	 * inclusive start
	 * inclusive end
	 * */

	require("views/lib/date-utils");
	Date.prototype.toArray = function(){return [this.getFullYear(),(this.getMonth()+1),this.getDate()];};
	const _ = require("views/lib/underscore");
	
	const start = new Date(doc.time.start);
	const end = new Date(doc.time.end);
	var outputDate = (new Date(start)).addDays(1);
	const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
	
	function dayStrToNum(day){
	    return days.indexOf(day);
	};
	
	function getDaysOfWeekForCampaign(){
	    if(doc.all_days){
		return days.map(dayStrToNum);
	    }
	    else if(doc.days_and_hours){
		return _(doc.days_and_hours)
		    .chain()
		    .pluck('day')
		    .map(dayStrToNum).value();
	    }
	    else{
		return [];
	    }
	};
	const daysOfWeekToRunOn = getDaysOfWeekForCampaign();

	function dayOfWeekCheck(date){
	    return _.contains(daysOfWeekToRunOn,date.getDay());
	};

	emit(start.toArray() , doc._id);
	while (outputDate.between(start,end)) {
	    if(dayOfWeekCheck(outputDate)){
  		emit(outputDate.toArray(), doc._id);
	    }
	    outputDate.addDays(1);
	}
    }
};


ddoc.views.CampaignName = {
    map:function(doc) {
	emit(doc.name, doc);
    }
};

ddoc.views.advertisers = {
    map:function(doc) {
	emit(doc.advertiser,1);
    },reduce:"_sum"
};
ddoc.views.salesPeople = {
    map:function(doc) {
	emit(doc.salesperson,1);
    },reduce:"_sum"
};

ddoc.filters.forLocation = function(doc, req) {

    function contains(array, item){return (array.indexOf(item) != -1);};
    function isArray(obj) {return toString.call(obj) === '[object Array]';};
    function isEmpty(array){return (array.length != 0);};    
    Date.compareTo = function (date1, date2) {
        if (date1.valueOf() < date2.valueOf()) {
            return -1;
        } else if (date1.valueOf() > date2.valueOf()) {
            return 1;
        }
        return 0;
    };
    Date.prototype.isBefore = function (date){
        date = date ? date : new Date();
        return (Date.compareTo(this,date) < 0);
    };


    function clean(str){
	return str.trim().toLowerCase();
    };
    function ultraClean(str){
	return clean(str).split(" ").join("");
    };
    function compareStr(str1,str2){
	return (clean(str1) == clean(str2));
    };

    const campaign = doc;    

    const requestLocation = req.query;    

    function matcher(request,campaign)
    { 
	return{
	    countryMatcher : function(){
		if(campaign.country && 
		   !campaign.province && 
		   request.country){
		    return compareStr(campaign.country, request.country);
		}
		return false;
	    },
	    provinceMatcher : function(){
		if(campaign.country && 
		   campaign.province && 
		   !campaign.city && 
		   request.province){
		    return compareStr(campaign.province, request.province);
		}
		return false;
	    },

	    cityMatcher : function(){
		if(campaign.country && 
		   campaign.province && 
		   campaign.city && 
		   !campaign.postalCode && 
		   !campaign.areaCode && 
		   request.city){
		    return compareStr(campaign.city, request.city);
		}
		return false;
	    },
	    areaCodeMatcher : function(){
		if(campaign.country && 
		   campaign.province && 
		   campaign.city && 
		   !campaign.postalCode && 
		   campaign.areaCode && 
		   request.areaCode){
		    return compareStr(campaign.areaCode, request.areaCode);
		}
		return false;
	    },

	    postalCodeMatcher : function(){
		if(campaign.country && 
		   campaign.province && 
		   campaign.city && 
		   campaign.postalCode && 
		   !campaign.areaCode && 
		   request.postalCode){
		    const campPostal = ultraClean(campaign.postalCode);
		    const reqPostal = ultraClean(request.postalCode);
		    return compareStr(campPostal.substr(0,reqPostal.length),campPostal);
		}
		return false;
	    },

	    companyMatcher : function(){
		if(campaign.company && 
		   !campaign.store && 
		   request.company){
		    return compareStr(campaign.company,request.company);
		}
		return false;
	    },
	    
	    storeMatcher : function(){
		if(campaign.company && 
		   request.company && 
		   campaign.store && 
		   request.store){
		    return compareStr(campaign.store,request.store) && 
			compareStr(campaign.company,request.company);
		}
		return false;
	    },

	    terminalMatcher : function(){
		if(campaign.terminal && 
		   request.terminal ){
		    return compareStr(campaign.terminal,request.terminal);
		}
		return false;
	    },

	    locationMatcher : function(){
		return this.countryMatcher() ||
		    this.provinceMatcher() ||
		    this.cityMatcher()||
		    this.areaCodeMatcher()||
		    this.postalCodeMatcher();
	    },

	    allMatcher : function(){
		return (campaign.all_terminals); },
	    
	    noLocation : function(){
		return (!campaign.country &&
		       !campaign.province &&
		       !campaign.city &&
		       !campaign.areaCode &&
		       !campaign.postalCode);
	    }

	};
    };
    function complicatedMatcher(requestLocation){
	return function(locationToMatch){
	    const m = new matcher(requestLocation,locationToMatch);

	    //all terminals
	    if(m.allMatcher()){return true;}
	    
	    //terminal
	    if(m.terminalMatcher()) {return true;}

	    //store
	    if(m.storeMatcher()) {return true;}

	    //company and no location
	    if(m.companyMatcher() && m.noLocation()){return true;}

	    //only company but wrong location
	    if(m.companyMatcher() && !m.locationMatcher()){return false;}

	    //company + location match
	    if(m.companyMatcher() && m.locationMatcher()){return true;}

	    //only location	    
	    return m.locationMatcher();
	};
    };
    
    //test for if the terminal was created after the campaign was started, and if the campaign is allowed to run on new terminals
    if(campaign.for_terminals_created_before){
	const created_before_date = new Date(campaign.for_terminals_created_before);
	const terminal_creation_date = new Date(requestLocation.creation_date);
	if(created_before_date.isBefore(terminal_creation_date)){return false;}	
    }
    if(campaign.locations && isArray(campaign.locations)){   
	return campaign.locations.some(complicatedMatcher(requestLocation));
    }
    return false;	
};

const test = function(name,fun){
    if(!fun){
	console.log("Test " + name + " : Failed");
    }
};

const filterTests = function(loc){
    camp0 = { locations:[{all_terminals:true}]};
    camp1 = { locations:[{country:"canada"}]};
    camp2 = { locations:[{country:"brazil"}]};
    camp3 = { locations:[{country:"brazil"},{country:"canada"}]};
    camp4 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"USA"}]};
    camp5 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada"}]};
    camp6 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"quebec"}]};
    camp7 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario"}]};
    camp8 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario",city:"toronto"}]};
    camp9 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario",city:"mississauga"}]};
    camp10 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario",city:"mississauga"},{country:"Canada" ,province:"Ontario",city:"toronto"}]};
    
    camp11 = { locations:[{country:"brazil",privince:"somewhere south"},
			  {country:"Canada" ,province:"Ontario",city:"mississauga"},
			  {country:"Canada" ,province:"Ontario",city:"toronto", areaCode:"905"},
			  {country:"Canada" ,province:"Ontario",city:"toronto", company : "hero burger"}]};

    camp12 =  { locations:[{company : "hero burger"}]};

    camp13 = { locations:[{country:"brazil",privince:"somewhere south"},
			  {country:"Canada" ,province:"Ontario",city:"mississauga"},
			  {country:"Canada" ,province:"Ontario",city:"toronto", areaCode:"905"},
			  {country:"Canada" ,province:"Ontario",city:"toronto", postalCode:"m5"}]};

    camp14 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario",city:"toronto",areaCode: "416"}]};

    camp15 = { locations:[{country:"brazil",privince:"somewhere south"},{country:"Canada" ,province:"Ontario",city:"toronto",areaCode: "905"}]};
    camp16 = { locations:[{country:"brazil",privince:"somewhere south"},
			  {country:"Canada" ,province:"Ontario",city:"toronto",areaCode: "905"},
			  {terminal:"RT7-RT7-30"}]};

    camp17 = { locations:[{country:"brazil",privince:"somewhere south"},
			  {country:"Canada" ,province:"Ontario",city:"toronto",areaCode: "905"},
			  {terminal:"RT7-RT7-30"}],
	     for_terminals_created_before:"2011-09-03T16:14:01.405Z"};

    req1 = {  query : {country:"canada",province:"ontario",city:"toronto",areaCode:"416",postalCode:"m5n 4g8",store:"queen west",company:"hero burger",terminal:"RT7-RT7-30",creation_date:"2011-09-02T16:14:01.405Z"}};
    req2 = {  query : {country:"canada",province:"ontario",city:"toronto",areaCode:"416",postalCode:"m5n 4g8",store:"queen west",company:"hero burger",terminal:"RT7-RT7-30",creation_date:"2011-11-02T16:14:01.405Z"}};
    
    test("0 all test, match",loc(camp0,req1));
    test("1 single country test, county match",loc(camp1,req1));
    test("2 single country test, no match",(!loc(camp2,req1)));
    test("3 multiple country test, match",(loc(camp3,req1)));
    test("4 multiple country single prov test,no match",(!loc(camp4,req1)));
    test("5 multiple country single prov test, match",(loc(camp5,req1)));
    test("6 multiple country multiple prov test, no match",(!loc(camp6,req1)));
    test("7 multiple country multiple prov test,  match",(loc(camp7,req1)));
    test("8 multi country multi prov single city test,  match",(loc(camp8,req1)));
    test("9 multi country multi prov single city test, no  match",(!loc(camp9,req1)));
    test("10 multi country multi prov multi city test,   match",(loc(camp10,req1)));
    test("11 city  + company,  match",(loc(camp11,req1)));
    test("12 company,  match",(loc(camp12,req1)));
    test("13 postalCode,  match",(loc(camp13,req1)));
    test("14 areaCode,  match",(loc(camp14,req1)));
    test("15 areaCode, no  match",(!loc(camp15,req1)));
    test("16 terminal ID,  match",(loc(camp16,req1)));
    test("17 terminal created after campaign start, no  match",(!loc(camp17,req2)));
    console.log("finished tests");
};

filterTests(ddoc.filters.forLocation);

ddoc.views.lib = couchapp.loadFiles('./common');
couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;