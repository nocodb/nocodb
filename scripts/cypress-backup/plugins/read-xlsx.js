// https://stackoverflow.com/questions/61934443/read-excel-files-in-cypress

const fs = require("fs");
const XLSX = require("xlsx");

const read = ({ file, sheet }) => {
    const buf = fs.readFileSync(file);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
    return rows;
};

// const read = ({file, sheet}) => {
//    const buf = fs.readFileSync(file);
//    const workbook = XLSX.read(buf, { type: 'buffer' });
//    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], {
//         header: 1,
//         blankrows: false
//     });
//    return rows
// }

const sheetList = ({ file }) => {
    const buf = fs.readFileSync(file);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const rows = workbook.SheetNames;
    return rows;
};

module.exports = {
    read,
    sheetList,
};
