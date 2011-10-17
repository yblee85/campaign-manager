var stores_rt7_db = db("stores_rt7");
var ids_v = view("app","ids");
var cities_v = view("app","cities");
var postal_code_v = view("app","postal_code_raw");
var state_province_v = view("app","state_province");
var country_v = view("app","country");

function extractKeys(data){
    return _.pluck(data.rows, 'key');
};

function processRichData(formData){
    if(formData.address && formData.address.street){
	formData.address.street = formData.address.street.split("\n");
    }
    if(formData.address && formData.address.phones){
	formData.address.phones = formData.address.phones.split("\n");
    }
    if(formData.address && formData.address.emails){
	formData.address.emails = formData.address.emails.split("\n");
    }
    return formData;
};

function extractFormData()
{
    var formData = form2object("testForm", '.', true,
			 function(node)
			       {
				   if (node.id && node.id.match(/callbackTest/))
				   {
				       return { name: node.id, value: node.innerHTML };
				   }
			       });
    //document.getElementById("testArea").innerHTML = JSON.stringify(formData, null, '\t');
    return formData;
}

function basicAutoComplete(view,input){
    groupQuery(view,stores_rt7_db,1)(function(data){
					   var keys = extractKeys(data);
					   $("#"+input).autocomplete({source:keys});
				       });
};
function doc_setup(){
    basicAutoComplete(cities_v,"city");
    basicAutoComplete(postal_code_v,"zip_postal");
    basicAutoComplete(state_province_v,"state_prov");
    basicAutoComplete(country_v,"country");

    $('#btnDel').attr('disabled',true);
    $('#btnAdd')
	.click(function() {
		   var num     = $('.clonedInput').length; // how many "duplicatable" input fields we currently have
		   var newNum  = new Number(num + 1);      // the numeric ID of the new input field being added
			   
		   // create the new element via clone(), and manipulate it's ID using newNum value
		   var newElem = $('#input' + num).clone().attr('id', 'input' + newNum);
			   
		   // manipulate the name/id values of the input inside the new element
		   var childrenToModify = newElem.children().children().children();
		   console.log(childrenToModify);
		   childrenToModify.each(function(index,el){
					     var attributes = el.attributes;
					     var names = attributes.name;
					     var nodeValue = names.nodeValue;
					     var newName = nodeValue.replace(/\d+/,(newNum-1));
					     console.log(newName);
					     $(el).attr('id', 'name' + newNum);
					     $(el).attr('name', newName);
					 });
		   // insert the new element after the last "duplicatable" input field
		   $('#input' + num).after(newElem);
		   
		   // enable the "remove" button
		   $('#btnDel:first').attr('disabled',false);
		   
	       });
    $('#btnDel')
	.click(function() {
		   var num = $('.clonedInput').length; // how many "duplicatable" input fields we currently have
		   $('#input' + num).remove();     // remove the last element
		   
		   // enable the "add" button
		   $('#btnAdd').attr('disabled',false);
		   
		   // if only one element remains, disable the "remove" button
		   if (num-1 == 1)
		       $('#btnDel').attr('disabled',true);
	       });
    $('#testForm')
	.submit(function() {
		    var formData = processRichData(extractFormData());
		    console.log("store data");
		    console.log(formData);
		    storesDB.saveDoc(formData);
		    alert('The store has been submitted');
		    return false;
		});
};
