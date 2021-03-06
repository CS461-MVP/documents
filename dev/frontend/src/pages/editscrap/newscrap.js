import 'fetch';
import { HttpClient, json } from 'aurelia-fetch-client';
import { Cookies } from 'aurelia-plugins-cookies';
import { inject, computedFrom } from 'aurelia-framework';
import { MdToastService } from 'aurelia-materialize-bridge';
import { EventAggregator } from 'aurelia-event-aggregator';

let httpClient = new HttpClient();

@inject(EventAggregator, MdToastService)
export class NewScrap {
    constructor(eventag, toast) {
        this.ea = eventag;
        this.toast = toast;
        this.disabledValue = !this.disabledValue;
    }

    userText = '';
    labelValue = null;
    enableLatex = false;
    disabledValue = false;
    submitTags = false;
    submitTagsText = [];

    toggleDisabled() {
        this.disabledValue = !this.disabledValue;
        this.submitTags = !this.submitTags;
    }

    submitImageScrap() {

        var form = new FormData();
        form.append('image', this.selectedFile);

        var theAuthor = Cookies.get('username');
        var theChapter = this.chapters[1];
        var authToken = "Token " + Cookies.get('token');

        if (theChapter === undefined || theChapter === null || theChapter === "") {

            //CREATE THE NEW SCRAP AND GET THE NEW SCRAP ID
            var scrapID = '';
            httpClient.fetch('https://remix.ist/images/new', {
                    method: 'post',
                    body: form,
                    headers: {
                        'Authorization': authToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    var scrapID = data.uuid;
                    this.toast.show('Scrap saved successfully!', 5000);
                    this.ea.publish('new-scrap', data);
                });
        } else { //The Chapter Was Provided, so create the scrap and then add it to a chapter.

            //CREATE THE NEW SCRAP AND GET THE NEW SCRAP ID
            var scrapID = '';
            httpClient.fetch('https://remix.ist/scraps/new', {
                    method: 'post',
                    body: form,
                    headers: {
                        'Authorization': authToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    var new_scrap = data;
                    var scrapID = data.uuid;

                    this.scraps = [];
                    var test = [];
                    //GET CHAPTERS SCRAPS
                    httpClient.fetch('https://remix.ist/chapters/' + theAuthor + '/' + theChapter)
                        .then(response => response.json())
                        .then(data => {

                            var scraps;
                            this.scraps.push(data);
                            scraps = data.scraps;

                            var newScrapRequest = [];

                            for (var i = 0; i < scraps.length; i++) {
                                newScrapRequest.push([scraps[i][0], scraps[i][1], scraps[i][2]]);
                            }
                            newScrapRequest.push([theAuthor, scrapID, null]);
                            let request2 = {
                                scraps: newScrapRequest
                            };

                            //   UPDATE CHAPTER WITH NEW SCRAPS
                            httpClient.fetch('https://remix.ist/chapters/' + theAuthor + '/' + theChapter, {
                                    method: 'post',
                                    body: JSON.stringify(request2),
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': authToken
                                    }
                                })
                                .then(response => response.json())
                                .then(data => {
                                    this.toast.show('Scrap saved successfully!', 5000);
                                    this.ea.publish('new-scrap', new_scrap);
                                });
                        });
                });
        }
        return;
    }

    addBold(){
      var requested = this.userText;
      requested += "\\textbf{}";
      this.userText = requested;
    }

    addItalic(){
      var requested = this.userText;
      requested += "\\emph{ }";
      this.userText = requested;
    }

    addUnderline(){
      var requested = this.userText;
      requested += "\\underline{}";
      this.userText = requested;
    }

    // addHRule(){
    //   var requested = this.userText;
    //   requested += "\\hline";
    //   this.userText = requested;
    // }

    addSubSection(){
      var requested = this.userText;
      requested += "\\subsection{}";
      this.userText = requested;
    }

    addSubSubSection(){
      var requested = this.userText;
      requested += "\\subsubsection{}";
      this.userText = requested;
    }

    addParagraph(){
      var requested = this.userText;
      requested += "\\paragraph{}";
      this.userText = requested;
    }

    addSpace(){
      var requested = this.userText;
      requested += "\\vspace{5pt}";
      this.userText = requested;
    }

    addNewPage(){
      var requested = this.userText;
      requested += "\\newpage";
      this.userText = requested;
    }

    addClearPage(){
      var requested = this.userText;
      requested += "\\clearpage";
      this.userText = requested;
    }

    submitNewScrap() {

        if (this.selectedFile) {
            this.submitImageScrap();
            return;
        }

        var requested = this.userText;
        var enableLatex = this.enableLatex;
        var theAuthor = Cookies.get('username');
        var theChapter = this.chapters[1];
        var authToken = "Token " + Cookies.get('token');

        var submitTags = this.submitTags;
        var submittedTags = this.submitTagsText;

        if (theChapter === undefined || theChapter === null || theChapter === "") {
            if (submitTags) {
                submittedTags = submittedTags.toString();
                submittedTags = submittedTags.replace(/(^,)|(,$)/g, "");
                submittedTags = submittedTags.replace(/\s/g, '');
                submittedTags = submittedTags.split(",");
            }
            let request = {
                author: theAuthor,
                text: requested,
                latex: enableLatex,
                tags: submittedTags
            };

            //CREATE THE NEW SCRAP AND GET THE NEW SCRAP ID
            var scrapID = '';
            httpClient.fetch('https://remix.ist/scraps/new', {
                    method: 'post',
                    body: JSON.stringify(request),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    var scrapID = data.uuid;
                    this.toast.show('Scrap saved successfully!', 5000);
                    this.ea.publish('new-scrap', data);
                });
        } else { //The Chapter Was Provided, so create the scrap and then add it to a chapter.
            if (submitTags) {
                submittedTags = submittedTags.toString();
                submittedTags = submittedTags.replace(/(^,)|(,$)/g, "");
                submittedTags = submittedTags.replace(/\s/g, '');
                submittedTags = submittedTags.split(",");
            }

            let request = {
                author: theAuthor,
                text: requested,
                latex: enableLatex,
                tags: submittedTags
            };

            //CREATE THE NEW SCRAP AND GET THE NEW SCRAP ID
            var scrapID = '';
            httpClient.fetch('https://remix.ist/scraps/new', {
                    method: 'post',
                    body: JSON.stringify(request),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    var new_scrap = data;
                    var scrapID = data.uuid;

                    this.scraps = [];
                    var test = [];
                    //GET CHAPTERS SCRAPS
                    httpClient.fetch('https://remix.ist/chapters/' + theAuthor + '/' + theChapter)
                        .then(response => response.json())
                        .then(data => {

                            var scraps;
                            this.scraps.push(data);
                            scraps = data.scraps;

                            var newScrapRequest = [];

                            for (var i = 0; i < scraps.length; i++) {
                                newScrapRequest.push([scraps[i][0], scraps[i][1], scraps[i][2]]);
                            }
                            newScrapRequest.push([theAuthor, scrapID, null]);
                            let request2 = {
                                scraps: newScrapRequest
                            };

                            //   UPDATE CHAPTER WITH NEW SCRAPS
                            httpClient.fetch('https://remix.ist/chapters/' + theAuthor + '/' + theChapter, {
                                    method: 'post',
                                    body: JSON.stringify(request2),
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': authToken
                                    }
                                })
                                .then(response => response.json())
                                .then(data => {
                                    this.toast.show('Scrap saved successfully!', 5000);
                                    this.ea.publish('new-scrap', new_scrap);
                                });
                        });
                });
        }
    }

    get selectedFile() {
        return this.fileInput.files.length > 0 ? this.fileInput.files[0] : '';
    }


    activate(chapterID) {
        var author = '';
        var chapter = '';

        author = chapterID.author;
        chapter = chapterID.uuid;

        this.chapters = [];

        this.chapters.push(author);
        this.chapters.push(chapter);
    }
}
