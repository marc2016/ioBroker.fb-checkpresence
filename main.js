'use strict';

/*
 * Created with @iobroker/create-adapter vunknown
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const request = require('request');
const schedule = require('node-schedule');
var parser = require('cron-parser');

var gthis; //Global verfügbar machen

// HTML Tabelle
function CreateHTMLRow (sUser, sStatus, sComming, sGoing) {
	var sHTML = "";
	sHTML += "<tr>";
	sHTML += "<td>"+sUser+"</td>"
	sHTML += "<td>"+(sStatus ? '<div class="mdui-green-bg mdui-state mdui-card">anwesend</div>' : '<div class="mdui-red-bg mdui-state mdui-card">abwesend</div>')+"</td>"
	sHTML += "<td>"+sComming+"</td>"
	sHTML += "<td>"+sGoing+"</td>"
	sHTML += "</tr>";	

	return sHTML;
}

// JSON Tabelle
function CreateRow (sHeadUser, sUser, sHeadStatus, sStatus, sHeadComming,sComming, sHeadGoing,sGoing) {
	var sJson = "{";
	sJson += '"'  + sHeadUser + '":';
	sJson += '"'  + sUser + '"' + ",";
	sJson += '"'  + sHeadStatus + '"' + ":";
	sJson += '"'  + sStatus + '"' + ",";
	sJson += '"'  + sHeadComming + '"' + ":";
	sJson += '"'  + sComming + '"' + ",";
	sJson += '"'  + sHeadGoing + '"' + ":";
	sJson += '"'  + sGoing + '"' + "}";

	return sJson;
}

// Nullen voranstellen
function aLZ(n){
  if(n <= 9){
    return "0" + n;
  }
  return n
}

// Fritzbox abfragen
function soapAction(sIP, sUri, sService, sAction, sParameter, sVal) {
    var uri = "http://" + sIP + ":49000";
    const urn = "urn:dslforum-org:service:";
    var sPar = "";
    if (sParameter != ""){
        sPar = "<" + sParameter + ">" + sVal + "</" + sParameter + ">";
    }
    var url = {
        uri: uri + sUri,
        headers: {
            'Content-Type': 'text/xml',
            'charset': 'utf-8',
            'SOAPAction': urn + sService + '#' + sAction
        },
        method: 'POST',
        body: 
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
                '<s:Body>' +
                    '<u:' + sAction + ' xmlns:u="' + urn + sService + '" >' +
                    sPar +
                    '</u:' + sAction + '>' +
                '</s:Body>' +
            '</s:Envelope>' 
    }
	return new Promise((resolve, reject) => {
		request(url, (error, response, body) => {
			if (error) reject(error);
			if (response.statusCode != 200) {
				reject('Invalid status code <' + response.statusCode + '>');
			}
			resolve(body);
		});
	});
}

class FbCheckpresence extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'fb-checkpresence',
        });
        this.on('ready', this.onReady);
        this.on('objectChange', this.onObjectChange);
        this.on('stateChange', this.onStateChange);
        // this.on("message", this.onMessage);
        this.on('unload', this.onUnload);
		gthis=this;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config ip-address: ' + this.config.ipaddress);
        this.log.info('config interval: ' + this.config.interval);

        // Reset connection state at start
        this.setState('info.connection', false, true);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
	    this.log.info('adapter fb-checkpresence started');
		var sIpfritz = this.config.ipaddress;
		this.log.info('ip address fritzbox: '+ sIpfritz);
		if (!this.config.familymembers) {
			this.log.info('no family members defined');
			return
		}else{
			/*
			For every state in the system there has to be also an object of type state
			Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
			*/
			await this.setObjectAsync("info.connection", {
				type: "state",
				common: {
					name: "Fritzbox connection",
					type: "boolean",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectAsync("presence", {
				type: "state",
				common: {
					name: "presence",
					type: "boolean",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectAsync("json", {
				type: "state",
				common: {
					name: "JSON table",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectAsync("html", {
				type: "state",
				common: {
					name: "HTML table",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});
			
			for (var k = 0; k < this.config.familymembers.length; k++) {
				var device = this.config.familymembers[k];
				var member = device.familymember;
				var mac = device.macaddress;
				var enabled = device.enabled;
				
				if (enabled == true){
					this.log.info('family member: ' + member + "(" + mac + ")");

					await this.setObjectAsync(member, {
						type: "state",
						common: {
							name: member,
							type: "boolean",
							role: "indicator",
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectAsync(member + ".going", {
						type: "state",
						common: {
							name: member + ".going",
							type: "string",
							role: "indicator",
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectAsync(member + ".comming", {
						type: "state",
						common: {
							name: member + ".comming",
							type: "string",
							role: "indicator",
							read: true,
							write: false,
						},
						native: {},
					});
				}
			}
		}			
		// in this template all states changes inside the adapters namespace are subscribed
		this.subscribeStates("*");	

		var sCron = "*/" + this.config.interval + " * * * *";
		var interval = parser.parseExpression(sCron);
		this.log.info("CRON string: " + sCron);
		var pres = false;
		var j = schedule.scheduleJob(sCron, async function(){
			pres = false;
			var jsontab = "[";
			var sHTML = "<table style='width:100%'><thead><tr><th style='text-align:left;'>Name</th><th style='text-align:left;'>Status</th><th style='text-align:left;'>Kommt</th><th style='text-align:left;'>Geht</th></tr></thead><tbody>";
			for (var k = 0; k < gthis.config.familymembers.length; k++) {
				var device = gthis.config.familymembers[k];
				var member = device.familymember;
				var mac = device.macaddress;
				var enabled = device.enabled;
				let current_datetime = new Date()
				let formatted_date = current_datetime.getFullYear() + "-" + aLZ(current_datetime.getMonth() + 1) + "-" + aLZ(current_datetime.getDate()) + " " + aLZ(current_datetime.getHours()) + ":" + aLZ(current_datetime.getMinutes()) + ":" + aLZ(current_datetime.getSeconds())
				var bActive = false;
				var sComming;
				var sGoing;
				
				if (enabled == true){
					gthis.log.info("start soap action");
					try {
						const soap = await soapAction(sIpfritz, "/upnp/control/hosts", "Hosts:1", "GetSpecificHostEntry", "NewMACAddress", mac);
						gthis.setState("info.connection", { val: true, ack: true });
						gthis.log.info(soap);
						var n = soap.search("NewActive>1</NewActive");
						//gthis.log.info("Position: " + n);
						if (n >= 0){
							bActive = true;
							gthis.getState(member, function (err, state) {
								gthis.log.info("state: " + state.val);
								gthis.log.info("Date: " + formatted_date);
								if (state.val == false){
									gthis.log.info(member + ".comming: " + formatted_date);
									gthis.setState(member + ".comming", { val: formatted_date, ack: true });
								}
							});
							gthis.setState(member, { val: true, ack: true });
							gthis.log.info(member + ".active: " + true);
							pres = true;
						}else{
							gthis.getState(member, function (err, state) {
								gthis.log.info("Date: " + formatted_date);
								gthis.log.info("state: " + state.val);
								if (state.val == true){
									gthis.log.info(member + ".going: " + formatted_date);
									gthis.setState(member + ".going", { val: formatted_date, ack: true });
								}
							});
							gthis.setState(member, { val: false, ack: true });
							gthis.log.info(member + ".active: " + false);
						}
						gthis.getState(member + ".comming", function (err, state) {
							sComming = state.val;
						});
						gthis.getState(member + ".going", function (err, state) {
							sGoing = state.val;
						});
						jsontab += CreateRow("Name", member, "Active", bActive, "Kommt", sComming, "Geht", sGoing);
						sHTML += CreateHTMLRow(member, bActive, sComming, sGoing);
						if (k < gthis.config.familymembers.length-1){
							jsontab += ",";
						}
					} catch (error) {
						gthis.setState("info.connection", { val: false, ack: true });
						gthis.log.error('ERROR:');
						gthis.log.error(error);
					}
				}
			}
			jsontab += "]";
			sHTML += "</body></table>";  
			gthis.setState("json", { val: jsontab, ack: true });
			gthis.setState("html", { val: sHTML, ack: true });
			if (pres == true){
				gthis.setState("presence", { val: true, ack: true });
			}else{
				gthis.setState("presence", { val: false, ack: true });
			}
		});
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}

if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new FbCheckpresence(options);
} else {
    // otherwise start the instance directly
    new FbCheckpresence();
}