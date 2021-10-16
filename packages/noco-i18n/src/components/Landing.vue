<template>
  <div class="wrapper">
    <h1>Welcome to NocoDB i18n CSV Converter</h1>
    <h2>
      For the guideline, please check out <a href="https://github.com/nocodb/nocodb/tree/master/packages/noco-i18n#contribution-guide" target="_blank" rel="noopener">NocoDB i18n Contribution Guide</a>.
    </h2>

  <table>
    <tr>
      <td>Upload your CSV file</td>
      <td>
        <div>
          <input type="file" id="file" ref="csvFile" class="file-input" @change="uploadFile">
          <label for="file">
            <span>Select your CSV</span>
          </label>
        </div>
      </td>
    </tr>

    <tr v-if="completeStep1">
      <td>Select the language you translated</td>
      <td>
        <div class="select-wrapper">
          <select v-on:change="changeItem($event)">
            <option value="-">Select the language</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Española</option>
            <option value="pt">Portuguese</option>
            <option value="it_IT">Italiano</option>
            <option value="nl">Nederlandse</option>
            <option value="ja">日本語</option>
            <option value="ko">한국인</option>
            <option value="ru">Pусский</option>
            <option value="id">Bahasa Indonesia</option>
            <option value="zh_CN">大陆简体</option>
            <option value="zh_HK">香港繁體</option>
            <option value="zh_TW">臺灣正體</option>
            <option value="sv">Svenska</option>
            <option value="da">Dansk</option>
            <option value="vi">Tiếng Việt</option>
            <option value="fi">Norsk</option>
            <option value="hr">עִברִית</option>
            <option value="iw">Suomalainen</option>
            <option value="no">Українська</option>
            <option value="th">Hrvatski</option>
            <option value="uk">ไทย</option>
            <option value="pl">Polish</option>	    
          </select>
        </div>
      </td>
    </tr>
  </table>
  <h3 class="success-msg" v-if="completeStep2">The generated JSON file has been copied to your clipboard.</h3>
  </div>
</template>

<script>
const generate = require('../index');
const papa = require('papaparse');
export default {
  name: 'Landing',
  props: {
    msg: String
  },
  data() {
    return {
      completeStep1: false,
      completeStep2: false,
      selectedLanguage: "-",
    }
  },
  methods: {
    async changeItem(event) {
      let file = this.$refs.csvFile.files[0]
      if (!file || file.type != 'text/csv') {
        this.completeStep2 = false
        alert('No csv is selected')
        throw new Error('No csv is selected')
      } else {
        let targetLanguage = event.target.value;
        if(targetLanguage != '-') {
          papa.parse(file, {
              worker: true, 
              // step: function(result) {
              //   // console.log(result)
              // }, 
              complete: function(results) {
                generate(results.data, targetLanguage)
              }
          });
          this.completeStep2 = true
        } else {
          this.completeStep2 = false
        }
      }
    },
    uploadFile() {
      this.completeStep1 = true
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

[type="file"] {
  height: 0;
  overflow: hidden;
  width: 0;
}

[type="file"] + label {
  width: 128px;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  display: inline-block;
	font-family: 'Rubik', sans-serif;
	font-size: inherit;
  font-weight: 500;
  outline: none;
  padding: 20px  50px;
  position: relative;
  vertical-align: middle;
  background-color: #0180ff;
}

.select-wrapper {
  position: relative;
  display: block;
  width: 230px;
  height: 60px;
  line-height: 3;
  background: #2c3e50;
  overflow: hidden;
  border-radius: 5px;
  margin-top: 20px;
  margin-left: auto;
  margin-right: auto;
}

select {
  -webkit-appearance: none;
  -moz-appearance: none;
  -ms-appearance: none;
  appearance: none;
  outline: 0;
  box-shadow: none;
  border: 0 !important;
  background: #0180ff;
  background-image: none;
}

select {
  width: 100%;
  height: 100%;
  margin: 0;
  text-align: center;
  cursor: pointer;
  color: #fff;
	font-family: 'Rubik', sans-serif;
  font-weight: 500;
  font-size: inherit; 
}
select::-ms-expand {
  display: none;
}

.select-wrapper::after {
  content: '\25BC';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  padding: 5px 15px;
  background: #0180ff;
  color: #fff;
  pointer-events: none;
}

table {
    margin-left: auto;
    margin-right: auto;
} 

td {
  padding: 10px 40px;
}

.success-msg {
  color: #4657eb;
}
</style>
