module.exports = async (csvDatas, targetLanguage) => {
    // function for mapping nested property
    const mapPropToObject = (obj, prop, val) => {
        const keys = prop.split('.');
        for (let i = 0, prev = obj; i < keys.length; i++) {
            // if last keys assign or overwrite value
            if (i === keys.length - 1) {
                prev[keys[i]] = val
            } else {
                // define or re-assign prev value
                prev = prev[keys[i]] = prev[keys[i]] || {}
            }
        }
    }

    // const downloadJson = (exportObj, exportName) => {
    //     var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2))
    //     var downloadAnchorNode = document.createElement('a')
    //     downloadAnchorNode.setAttribute("href", dataStr)
    //     downloadAnchorNode.setAttribute("download", exportName + ".json")
    //     document.body.appendChild(downloadAnchorNode)
    //     downloadAnchorNode.click()
    //     downloadAnchorNode.remove()
    // }

    const copyJsonToClipboard = (str, targetLanguage) => {
        var el = document.createElement('textarea')
        el.value = str
        el.setAttribute('readonly', '')
        el.style = {position: 'absolute', left: '-9999px'}
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        // alert("The target JSON has been copied to your clipboard")
        popEditPage(targetLanguage)
    }
    
    const popEditPage = (targetLanguage) => {
        var editAnchorNode = document.createElement('a')
        editAnchorNode.setAttribute("href", `https://github.com/nocodb/nocodb/edit/master/packages/nc-gui/lang/${targetLanguage}.json`)
        editAnchorNode.setAttribute("target", "_blank")
        document.body.appendChild(editAnchorNode)
        editAnchorNode.click()
        editAnchorNode.remove()
    }
    
    if (!csvDatas.length) throw new Error('Empty csv')
    
    const languageObjs = {};
    const languages = Object.keys(csvDatas[0]).filter(k => k !== 'String Key' && k !== 'String');
    
    for (const data of csvDatas) {
        for (const lan of languages) {
            languageObjs[lan] = languageObjs[lan] || {};
            mapPropToObject(languageObjs[lan], data[0], data[lan])
        }
    }    

    for (const [ln, obj] of Object.entries(languageObjs)) {
        if(languageObjs[ln]['String Key'] == targetLanguage) {
            delete languageObjs[ln]['String Key'];
            // downloadJson(obj, targetLanguage)
            copyJsonToClipboard(JSON.stringify(obj, null, 2), targetLanguage)
            return
        }
    }
}
