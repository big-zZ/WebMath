var equationEditor;
$(document).ready(function() {
    equationEditor = createEquationEditor(document.getElementById('EquationEditor'));
});

var degreeRedian = 0;
var value = 0;
var prec = 3;

function web_setDegreeRedian() {
    if(degreeRedian == 0) degreeRedian = 1;
    else degreeRedian = 0;
    web_setDegreeMode(degreeRedian);
}

function web_setValueMethod() {
    if(value == 0) value = 1;
    else value = 0;
    web_setPrecision(value, prec);
}

function web_declinePrecision() {
    prec --;
    if (prec <= 1) prec = 1;
    web_setPrecision(value, prec);
}
function web_addPrecision() {
    prec ++;
    if (prec >= 6) prec = 6;
    web_setPrecision(value, prec);
}

//设置值计算方式：（默认角度），如某公式编辑过需确保已经调用了web_reshowLastInputMath
//@mode 0-角度 1-弧度
function web_setDegreeMode(mode) {
    equationEditor.setDegreeMode(mode);
}

//设置精度：（默认去尾），如某公式编辑过需确保已经调用了web_reshowLastInputMath
//@mode 0-去尾 1-四舍五入
//@precision 小数点后几位
function web_setPrecision(mode, precision) {
    equationEditor.setPrecision(mode, precision);
}

//根据latex字符串，渲染公式(异步)
//@ratianResult 弧度计算结果
//@degreeResult 角度计算结果
function web_showLatex(latex, ratianResult, degreeResult) {
    //var tex = (solve) ? solver.solve(latex, degree, precision) : latex;
    equationEditor.showMath(latex, ratianResult, degreeResult);
}

//重新显示上一次编辑的公式(异步)
//@latex 在编辑公式后，如需重新计算结果，先调用web_getLatex获得新的latex字符串，再调用计算引擎计算结果后，再调用此方法重新显示该公式
//@ratianResult 弧度计算结果
//@degreeResult 角度计算结果
function web_reshowLastInputMath(latex, ratianResult, degreeResult) {
    equationEditor.reshowLastMath(latex, ratianResult, degreeResult);
}

//获取当前编辑公式的latex
function web_getLatex() {
    return equationEditor.getLatex();
}

//获取公式显示区域
//@return 返回json字符串，如：{ left: 0, top: 0, right: 100, bottom: 100 }
function web_getRect() {
    var rect = equationEditor.getRect();
    var str = JSON.stringify(rect);
    return str;
}

//获取每条公式的显示区域
//@return 返回数组，元素json字符串，如：{ left: 0, top: 0, right: 100, bottom: 100 }
function web_getAllRect() {
    var _allRectStrs = [];
    var _allRect = equationEditor.getAllRect();
    _allRect.forEach(element => {
        var _rectStr = JSON.stringify(element);
        _allRectStrs[_allRect.indexOf(element)] = _rectStr;
    });
    alert("web_getAllRect ->" + _allRectStrs);
    return _allRectStrs;
}

//键盘插入当前光标位置
//@latex 插入的latex字符串 部分数学符号需补充上占位符号？ 如根号 对应latex为\sqrt{?}
function web_keyboardInsert(latex) {
    equationEditor.insertCurrent(latex);
}

//键盘删除当前光标位置
function web_keyboardDel() {
    equationEditor.delCurrent();
}

//手写插入
//@x,y  起笔点坐标
function web_penInsert(latex, x, y) {
    equationEditor.insertByPen(latex, { x: x, y: y });
}

//手势删除
//传入笔画点Json字符串：[{x:10,y:10},{x:20,y:20}]
function web_penDel(pointJson) {
    var points = JSON.parse(pointJson);
    equationEditor.delByPen(points);
}

//撤销一条公式
function web_undo() {
    equationEditor.undo();
}

//恢复上一步
function web_redo() {
    equationEditor.redo();
}

//清除所有公式
function web_clear() {
    equationEditor.clearAll();
}

//查找连续的数字
//@x,y 按下的坐标点
//@return 对应位置连续的数字，否则返回空
function web_findNumber(x, y) {
    return equationEditor.findNumber({ x: x, y: y });
}

//设置光标位置
function web_setFocus(x, y) {
    equationEditor.setFocus({ x: x, y: y });
}

//左移光标
function web_changeFocusLeft() {
    equationEditor.changeFocusLeft();
}

//右移光标
function web_changeFocusRight() {
    equationEditor.changeFocusRight();
}