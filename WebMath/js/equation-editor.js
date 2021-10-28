var createEquationEditor = function(container) {
    //唯一ID
    var _mathId = 0;

    //存放ID对应的公式的所有属性映射
    //ID->{
    //latex:latex字符串,
    //rResult:弧度计算结果,
    //dResult:角度计算结果,
    //node:公式DOM
    //caret:光标类型，0-替换光标当前元素，1-在当前光标后面插入
    //modify:是否修改过 false/true
    //type:公式类型  0-方程式 1-等式
    //}
    var _mathInfo = [];

    //存放所有撤销的mathId
    var _undo = [];

    //存放每次undo的条目数，用于redo
    var _redo = [];

    //当前计算模式：0-角度 1-弧度
    var _degreeMode = 0;

    //当前精度模式：0-去尾 1-四舍五入
    var _precisionMode = 0;

    //当前小数点后保留位数
    var _precision = 3;

    //当前输入的公式
    var _currentInputMath = -1;

    var latexMathml = [
        ["\\pi", "π"],
        ["\\phi", "ϕ"],
        ["\\times", "×"],
        ["\\div", "÷"],
        ["\\%", "%"]
    ];

    var mathml2latex = new Map();
    for (let pair of latexMathml) {
        mathml2latex.set(pair[1], pair[0]);
    }

    //内部函数------------

    function get_top(e) {
        var offset = e.offsetTop;
        if (e.offsetParent != null)
            offset += get_top(e.offsetParent);
        return offset;
    }

    function get_left(e) {
        var offset = e.offsetLeft;
        if (e.offsetParent != null)
            offset += get_left(e.offsetParent);
        return offset;
    }

    function point_in_rect(ele, point) {
        //var rect = ele.getBoundingClientRect();
        var left = get_left(ele);
        var top = get_top(ele);
        var right = left + ele.clientWidth;
        var bottom = top + ele.clientHeight;

        if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)
            return true;
        return false;
    }

    function find_child_element_by_point(ele, point, checkSelf) {
        if (!ele || (ele.tagName.toLowerCase() == 'mjx-c'))
            return null;

        var inChildrenRect = false;
        var findEle = null;
        for (var i = 0; i < ele.childElementCount; i++) {
            var e = ele.children[i];
            findEle = find_child_element_by_point(e, point, true);
            if (findEle) {
                inChildrenRect = true;
                break;
            }
        }
        if (checkSelf && !inChildrenRect && point_in_rect(ele, point)) {
            findEle = ele;
        }
        return findEle;
    };

    function get_element_content(ele) {
        if (!ele || !ele.firstElementChild || ele.firstElementChild.tagName.toLowerCase() != 'mjx-c')
            return "";

        var content = "";
        for (var i = 0; i < ele.childElementCount; i++) {
            var e = ele.children[i];
            var str = window.getComputedStyle(e, '::before').getPropertyValue('content');
            if (str) {
                str = str.substring(1);
                str = str.substring(0, str.length - 1);
            } else {
                str = "";
            }
            content += str;
        }

        return content;
    }

    //查找问号占位符元素
    function find_and_replace_mark(node) {

        var f;
        for (var i = 0; i < node.childElementCount; i++) {

            var e = node.children[i];
            if (e.tagName.toLowerCase() != 'mjx-c') {
                f = find_and_replace_mark(e);
            } else {
                var str;
                var before = window.getComputedStyle(e, '::before');
                if (before)
                    str = before.getPropertyValue('content');

                if (str && str.indexOf('?') >= 0) {
                    f = e.parentElement.nextElementSibling.nextElementSibling.nextElementSibling;
                    e.parentElement.remove();

                    alert(e.latex)
                }

            }
            if (f) break;
        }
        return f;
    }

    function is_number(text) {
        var regPos = /^\d+(\.\d+)?$/; //非负浮点数
        var regNeg = /^(-(([0-9]+\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\.[0-9]+)|([0-9]*[1-9][0-9]*)))$/; //负浮点数
        if (regPos.test(text) || regNeg.test(text)) {
            return true;
        } else {
            return false;
        }
    }

    function change_focus_element(id, ele) {

        $('#' + id + ' .elementFocus').removeClass('elementFocus');
        if (_mathInfo[id].type == 0) {

            if (ele) {
                var c = get_element_content(ele);
                _mathInfo[id].caret = (c == '?') ? 0 : 1;
                _mathInfo[id].focus = ele;
            } else {
                //方程式，找到？号元素
                _mathInfo[id].caret = 1;
                _mathInfo[id].focus = find_and_replace_mark(_mathInfo[id].node.children[0]);
            }
            $(_mathInfo[id].focus).addClass('elementFocus');
        } else {

            if (ele) {
                _mathInfo[id].focus = ele;
                $(ele).addClass('elementFocus');
            } else {
                _mathInfo[id].focus = _mathInfo[id].node.firstElementChild.lastElementChild;
                $(_mathInfo[id].focus).addClass('elementFocus');
                $(_mathInfo[id].focus.previousElementSibling).addClass('elementFocus'); //=号也高亮 
            }
            _mathInfo[id].caret = 1;
        }
    }

    function insert_element_at_focus(math, children) {

        var focus = _mathInfo[_currentInputMath].focus;
        var caret = _mathInfo[_currentInputMath].caret;

        if (children) {
            var tmp1 = focus;
            var tmp2;
            while (math.childElementCount > 0) //调用after后math 中对应的这个元素会被移除
            {
                tmp2 = math.firstElementChild;
                tmp1.after(tmp2);
                tmp1 = tmp2;
            }
            if (caret == 0) {
                focus.remove();
            }
            change_focus_element(_currentInputMath, tmp1);
        } else {
            focus.after(math);
            if (caret == 0) {
                focus.remove();
            }
            change_focus_element(_currentInputMath, math);
        }
    }

    function get_pre_sibling(ele) {
        var sibling = ele;
        while (true) {
            sibling = sibling.previousElementSibling;
            if (!sibling)
                break;

            if (sibling.clientWidth > 0 && sibling.clientHeight > 0)
                break;
        }
        return sibling;
    }

    function get_next_sibling(ele) {
        var sibling = ele;
        while (true) {
            sibling = sibling.nextElementSibling;
            if (!sibling)
                break;

            if (sibling.clientWidth > 0 && sibling.clientHeight > 0)
                break;
        }
        return sibling;
    }

    function get_new_focus(ele, left) {
        if (!ele || !ele.parentElement) return null;

        var focus = null;
        if (ele.parentElement.childElementCount == 1) {
            focus = get_new_focus(ele.parentElement);
        } else {
            if (!left) {
                focus = get_pre_sibling(ele);
                if (!focus)
                    focus = get_next_sibling(ele);
            } else if (left == 1) {
                focus = get_pre_sibling(ele);
            } else if (left == 2) {
                focus = get_next_sibling(ele);
            }

            if (!focus)
                focus = get_new_focus(ele.parentElement);
        }
        return focus;
    }

    function delete_focus() {

        var ele = _mathInfo[_currentInputMath].focus;
        var focus = get_new_focus(ele);
        ele.remove();
        change_focus_element(_currentInputMath, focus);
    }

    function replace_element(id, pos, math, children) {
        if (!pos || !math)
            return;

        _currentInputMath = id;

        if (children) {
            var tmp1 = pos;
            var tmp2;
            while (math.childElementCount > 0) //调用after后math 中对应的这个元素会被移除
            {
                tmp2 = math.firstElementChild;
                tmp1.after(tmp2);
                tmp1 = tmp2;
            }
            pos.remove();
            change_focus_element(id, tmp1);
        } else {
            pos.after(math);
            pos.remove();
            change_focus_element(id, math);
        }
    }

    function delete_element(ele) {
        if (!ele)
            return;

        var focus = get_new_focus(ele);
        ele.remove();
        change_focus_element(_currentInputMath, focus);
    }

    function encode_latex(root) {
        if (!root) return '?';
        var type = root.tagName.toLowerCase();
        if (type == 'mjx-msub') {
            return encode_latex(root.children[0]) + '_{' + encode_latex(root.children[1]) + '}';
        } else if (type == 'mjx-msup') {
            return encode_latex(root.children[0]) + '^{' + encode_latex(root.children[1]) + '}';
        } else if (type == 'mjx-msubsup') {
            return encode_latex(root.children[0]) + '_{' + encode_latex(root.children[1].children[2]) + '}^{' + encode_latex(root.children[1].children[0]) + '}';
        } else if (type == 'mjx-frac') {
            return '\\frac{' + encode_latex(root.children[0]) + '}{' + encode_latex(root.children[1]) + '}';
        } else if (type == 'mjx-sqrt') {
            return '\\sqrt{' + encode_latex(root.children[1]) + '}';
        } else if (type == 'mjx-mroot') {
            return '\\sqrt[' + encode_latex(root.children[0]) + ']{' + encode_latex(root.children[1].children[1]) + '}';
        } else if (type == 'mjx-mi' || type == 'mjx-mo' || type == 'mjx-mn') {
            var content = get_element_content(root);
            if (mathml2latex.has(content)) {
                return mathml2latex.get(content) + ' ';
            } else {
                return content;
            }
        } else {
            var code = '';
            if (root.childElementCount > 0) {
                for (var j = 0; j < root.childElementCount; j++) {
                    code += encode_latex(root.children[j]);
                }
            } else {
                //code = '?';
            }
            return code;
        }
    };

    function complete_formula(latex, ratianResult, degreeResult) {

        var result = (_degreeMode == 0) ? degreeResult : ratianResult;
        var tex = '';
        var r = 0;
        var pow = Math.pow(10, _precision);
        if (_precisionMode == 0) {
            //去尾
            var isInteger = Math.floor(result) === result;
            if (isInteger == false) {
                var res = result.toString();
                var r_int = Math.floor(result).toString();
                res = res.substr(0, r_int.length + 1 + _precision);
                r = parseFloat(res);
            } else {
                r = result;
            }
        } else if (_precisionMode == 1) {
            //四舍五入
            r = Math.round(result * pow) / pow;
        }

        var index = latex.indexOf('?');
        if (index >= 0) {
            var str = r.toString();
            if (r < 0) {
                str = "("+str+")";
            }
            //方程式
            tex = latex.replace('?', '?' + str);
        } else {
            //等式
            tex = latex;
            tex += '=';
            tex += r.toString();
        }
        return tex;
    }

    function save_latex_result(latex, ratianResult, degreeResult, node, id) {

        var type = (latex.indexOf('?') >= 0) ? 0 : 1; //0-方程式 1-等式
        if (id) {
            $(node).attr("id", id);
            _mathInfo[id].node.after(node);
            _mathInfo[id].node.remove();
            _mathInfo[id].node = node;
            _mathInfo[id].latex = latex;
            _mathInfo[id].rResult = ratianResult;
            _mathInfo[id].dResult = degreeResult;
            _mathInfo[id].modify = false;
            _mathInfo[id].type = type;
        } else {
            _mathId++;
            $(node).attr("id", _mathId);
            container.appendChild(node);
            _mathInfo[_mathId] = { latex: latex, rResult: ratianResult, dResult: degreeResult, node: node, modify: false, type: type };
            _currentInputMath = _mathId;
        }
    }

    function reshow_math(id, update) {

        var tex = complete_formula(_mathInfo[id].latex, _mathInfo[id].rResult, _mathInfo[id].dResult);

        MathJax.texReset();
        MathJax.tex2chtmlPromise(tex, { display: true }).then(function(node) {

            save_latex_result(_mathInfo[id].latex, _mathInfo[id].rResult, _mathInfo[id].dResult, node, id);
            change_focus_element(id);

            if (update) {
                MathJax.startup.document.clear();
                MathJax.startup.document.updateDocument();
            }
        }).catch(function(err) {
            // 转换失败的处理
        }).then(function() {
            // 处理完毕后处理
        });
    }

    function reshow_all() {

        var len = container.childElementCount - 1;
        for (var i = 0; i <= len; i++) {

            var id = $(container.children[i]).attr('id');
            reshow_math(id, (i == len));
        }
    }
    //-------------------

    //外部函数---------------------
    var __fistTime = true;
    var showMath = function(latex, ratianResult, degreeResult) {
        var tex = complete_formula(latex, degreeResult, ratianResult);

        MathJax.texReset();
        MathJax.tex2chtmlPromise(tex, { display: true }).then(function(node) {

            save_latex_result(latex, ratianResult, degreeResult, node);
            if (__fistTime) {
                //首次show，找？占位符有问题，要延迟一下
                setTimeout(() => {
                    change_focus_element(_currentInputMath);
                }, 100);
                __fistTime = false;
            } else {
                change_focus_element(_currentInputMath);
            }
            //$(node).addClass('mathFocus');
            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();
        }).catch(function(err) {
            // 转换失败的处理
        }).then(function() {
            // 处理完毕后处理
        });
    };
    var reshowLastMath = function(latex, ratianResult, degreeResult) {

        var tex = complete_formula(latex, ratianResult, degreeResult);

        MathJax.texReset();
        MathJax.tex2chtmlPromise(tex, { display: true }).then(function(node) {

            save_latex_result(latex, ratianResult, degreeResult, node, _currentInputMath);
            change_focus_element(_currentInputMath);
            //$(node).addClass('mathFocus');

            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();
        }).catch(function(err) {
            // 转换失败的处理
        }).then(function() {
            // 处理完毕后处理
        });
    };

    var insertCurrent = function(latex) {
        MathJax.texReset();
        MathJax.tex2chtmlPromise(latex, { display: false }).then(function(node) {
            if (container.childElementCount <= 0) {

                save_latex_result(latex, 0, 0, node);
                change_focus_element(_currentInputMath, node.firstElementChild.lastElementChild);
            } else {
                insert_element_at_focus(node.children[0], true);
            }
            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();
        }).catch(function(err) {
            // 转换失败的处理
        }).then(function() {
            // 处理完毕后处理
        });
    };
    var delCurrent = function() {

        if (_currentInputMath < 0)
            return;

        delete_focus();
    }
    var insertByPen = function(latex, point) {
        MathJax.texReset();
        MathJax.tex2chtmlPromise(latex, { display: false }).then(function(node) {
            if (container.childElementCount <= 0) {
                save_latex_result(latex, 0, 0, node);
                change_focus_element(_currentInputMath, node.firstElementChild.lastElementChild);
            } else {
                var find, id;
                for (var i = 0; i < container.childElementCount; i++) {
                    find = find_child_element_by_point(container.children[i], point);
                    if (find) {
                        id = $(container.children[i]).attr('id');
                        break;
                    }
                }
                if (find) {
                    replace_element(id, find, node.children[0], true);
                } else {
                    insert_element_at_focus(node.children[0], true);
                }
            }

            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();
        }).catch(function(err) {
            // 转换失败的处理
        }).then(function() {
            // 处理完毕后处理
        });
    };
    var delByPen = function(points) {
        if (container.childElementCount <= 0)
            return;

        var find = [];
        for (var j = 0; j < container.childElementCount; j++) {
            for (var i = 0; i < points.length; i++) {
                var ele = find_child_element_by_point(container.children[j], points[i]);
                if (!ele)
                    continue;

                find.push(ele);

                //去除一些相同区域的点
                for (var k = i; k < points.length;) {
                    if (point_in_rect(ele, points[k])) {
                        points.splice(k, 1);
                    } else
                        k++;
                }
            }

            if (find.length > 0) {
                _currentInputMath = $(container.children[j]).attr('id');
                break;
            }
        }

        for (var i = 0; i < find.length; i++) {
            delete_element(find[i]);
        }
    };
    var getLatex = function() {

        if (_currentInputMath < 0)
            return '';

        // if (_mathInfo[_currentInputMath].modify) 
        {
            _mathInfo[_currentInputMath].latex = encode_latex(_mathInfo[_currentInputMath].node);
            _mathInfo[_currentInputMath].modify = false;
        }

        return _mathInfo[_currentInputMath].latex;
    }
    var getRect = function() {
        var math = container.lastElementChild;
        var left = 0,
            top = 0,
            right = 0,
            bottom = 0;

        if (math) {
            left = get_left(math);
            top = get_top(math);
            right = left + math.clientWidth;
            bottom = top + math.clientHeight;
        }

        return { left: left, top: top, right: right, bottom: bottom };
    }
    var undo = function() {
        if (container.childElementCount <= 0)
            return;

        var math = container.lastElementChild;
        var id = $(math).attr('id');

        math.remove();
        _undo.push(id);
        _redo.push(1);

        if (container.childElementCount > 0) {
            _currentInputMath = $(container.lastElementChild).attr('id');
        } else {
            _currentInputMath = -1;
        }
    }
    var redo = function() {
        if (_undo.length <= 0)
            return;

        var id;
        var undoCount = _redo.pop();
        for (var i = 0; i < undoCount; i++) {
            id = _undo.pop();
            container.appendChild(_mathInfo[id].node);
        }
        _currentInputMath = id;
    }
    var clearAll = function() {
        if (container.childElementCount <= 0)
            return;

        _redo.push(container.childElementCount);
        while (container.childElementCount > 0) {
            var math = container.lastElementChild;
            var id = $(math).attr('id');
            math.remove();
            _undo.push(id);
        }
        _currentInputMath = -1;
    }
    var findNumber = function(point) {
        var ele = find_child_element_by_point(container, point);
        if (!ele)
            return "";

        var content = get_element_content(ele);
        if (!is_number(content))
            return "";

        var number = [];
        number.push(content);

        //查找前面的
        var sibling = ele;
        while (true) {
            sibling = sibling.previousElementSibling;
            if (!sibling)
                break;

            var content = get_element_content(sibling);
            if (!is_number(content))
                break;

            number.unshift(content);
        }

        //查找后面的
        var sibling = ele;
        while (true) {
            sibling = sibling.nextElementSibling;
            if (!sibling)
                break;

            var content = get_element_content(sibling);
            if (!is_number(content))
                break;

            number.push(content);
        }

        return number.join('');
    };
    var setFocus = function(point) {

        for (var i = 0; i < container.childElementCount; i++) {

            var math = container.children[i];
            var ele = find_child_element_by_point(math, point);
            if (ele) {
                var id = $(math).attr('id');
                change_focus_element(id, ele);
                _currentInputMath = id;
                break;
            }

        }

    };
    var changeFocusLeft = function() {
        var focus = get_new_focus(_mathInfo[_currentInputMath].focus, 1);
        change_focus_element(_currentInputMath, focus);
    };
    var changeFocusRight = function() {
        var focus = get_new_focus(_mathInfo[_currentInputMath].focus, 2);
        change_focus_element(_currentInputMath, focus);
    }
    var setDegreeMode = function(mode) {
        if (_degreeMode != mode) {
            _degreeMode = mode;
            reshow_all();
        }
    }
    var setPrecision = function(mode, precision) {
            if ((_precisionMode != mode) || (_precision != precision)) {
                _precisionMode = mode;
                _precision = precision;
                reshow_all();
            }
        }
        //显示光标
        // var _showCaret = 0;
        // setInterval(() => {
        //     if (_currentInputMath < 0) return;

    //     var focus = _mathInfo[_currentInputMath].focus;
    //     var caret = _mathInfo[_currentInputMath].caret;

    //     if (++_showCaret >= 30000)
    //         _showCaret = 0;

    //     $('.caretRight').removeClass('caretRight');
    //     $('.caretLeft').removeClass('caretLeft');
    //     if (_showCaret % 2 == 0) {
    //         (caret == 0) ? $(focus).addClass('caretLeft'): $(focus).addClass('caretRight');
    //     }
    // }, 500);
    return {
        showMath: showMath,
        reshowLastMath: reshowLastMath,
        delCurrent: delCurrent,
        insertCurrent: insertCurrent,
        delByPen: delByPen,
        insertByPen: insertByPen,
        getLatex: getLatex,
        getRect: getRect,
        undo: undo,
        redo: redo,
        clearAll: clearAll,
        findNumber: findNumber,
        setFocus: setFocus,
        changeFocusLeft: changeFocusLeft,
        changeFocusRight: changeFocusRight,
        setDegreeMode: setDegreeMode,
        setPrecision: setPrecision
    };
};